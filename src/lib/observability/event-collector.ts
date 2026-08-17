/** @module-kind io */
/**
 * Sink de exportação de eventos estruturados — OPS-005.slice-02
 *
 * Integra amostragem determinística + buffer circular com um transporte HTTP
 * tolerante a falha. O coletor fica inativo quando não há endpoint configurado.
 */

import { EventBuffer } from "./event-buffer";
import { shouldSample } from "./sampling";
import { addSink, type StructuredEvent } from "./structured-logger";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
type TimerId = ReturnType<typeof setInterval>;

interface ListenerTargetLike {
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
}

interface DocumentLike extends ListenerTargetLike {
  visibilityState?: DocumentVisibilityState;
}

interface NavigatorLike {
  sendBeacon?: (url: string, data?: BodyInit | null) => boolean;
}

export type FlushReason = "manual" | "batch" | "interval" | "unload";

export interface ExternalEventsPayload {
  schemaVersion: 1;
  sentAt: string;
  reason: FlushReason;
  dropped: number;
  events: StructuredEvent[];
}

export interface ExternalCollectorDiagnostics {
  schemaVersion: 1;
  installed: boolean;
  endpoint: string | null;
  bufferSize: number;
  bufferCapacity: number;
  droppedTotal: number;
  inFlight: boolean;
  failures: number;
  backoffUntil: number;
  backoffRemainingMs: number;
  lastFlushAt: number | null;
  lastFlushReason: FlushReason | null;
  lastFlushOk: boolean | null;
  lastFlushError: string | null;
  lastFlushEvents: number;
  totalFlushes: number;
  totalEventsSent: number;
}

export interface ExternalEventSinkOptions {
  /** URL do coletor externo. Sem endpoint, `installExternalEventSink` não instala nada. */
  endpoint?: string;
  samplingRatio?: number;
  bufferCapacity?: number;
  batchSize?: number;
  flushIntervalMs?: number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  fetchFn?: FetchLike;
  now?: () => number;
  windowTarget?: ListenerTargetLike;
  documentTarget?: DocumentLike;
  navigatorLike?: NavigatorLike;
}

const DEFAULTS = {
  samplingRatio: 0.1,
  bufferCapacity: 200,
  batchSize: 25,
  flushIntervalMs: 10_000,
  baseBackoffMs: 1_000,
  maxBackoffMs: 30_000,
} as const;

let installed: { dispose: () => void; sink: ExternalEventSink } | null = null;

export function buildExternalEventsPayload(
  now: number,
  reason: FlushReason,
  events: StructuredEvent[],
  dropped: number,
): ExternalEventsPayload {
  return {
    schemaVersion: 1,
    sentAt: new Date(now).toISOString(),
    reason,
    dropped,
    events,
  };
}

export class ExternalEventSink {
  private readonly endpoint: string;
  private readonly samplingRatio: number;
  private readonly batchSize: number;
  private readonly flushIntervalMs: number;
  private readonly baseBackoffMs: number;
  private readonly maxBackoffMs: number;
  private readonly fetchFn?: FetchLike;
  private readonly now: () => number;
  private readonly windowTarget?: ListenerTargetLike;
  private readonly documentTarget?: DocumentLike;
  private readonly navigatorLike?: NavigatorLike;
  private readonly buffer: EventBuffer;
  private readonly teardown: Array<() => void> = [];
  private inFlight = false;
  private disposed = false;
  private timer: TimerId | undefined;
  private failures = 0;
  private backoffUntil = 0;
  private carriedDropped = 0;
  private droppedTotal = 0;
  private lastFlushAt: number | null = null;
  private lastFlushReason: FlushReason | null = null;
  private lastFlushOk: boolean | null = null;
  private lastFlushError: string | null = null;
  private lastFlushEvents = 0;
  private totalFlushes = 0;
  private totalEventsSent = 0;

  constructor(opts: ExternalEventSinkOptions) {
    const endpoint = opts.endpoint?.trim();
    if (!endpoint) throw new Error("ExternalEventSink: endpoint obrigatório");

    this.endpoint = endpoint;
    this.samplingRatio = numberOr(opts.samplingRatio, DEFAULTS.samplingRatio);
    this.batchSize = Math.max(1, Math.floor(numberOr(opts.batchSize, DEFAULTS.batchSize)));
    this.flushIntervalMs = Math.max(0, Math.floor(numberOr(opts.flushIntervalMs, DEFAULTS.flushIntervalMs)));
    this.baseBackoffMs = Math.max(0, Math.floor(numberOr(opts.baseBackoffMs, DEFAULTS.baseBackoffMs)));
    this.maxBackoffMs = Math.max(this.baseBackoffMs, Math.floor(numberOr(opts.maxBackoffMs, DEFAULTS.maxBackoffMs)));
    this.fetchFn = opts.fetchFn ?? defaultFetch();
    this.now = opts.now ?? (() => Date.now());
    this.windowTarget = opts.windowTarget ?? defaultWindowTarget();
    this.documentTarget = opts.documentTarget ?? defaultDocumentTarget();
    this.navigatorLike = opts.navigatorLike ?? defaultNavigator();
    this.buffer = new EventBuffer({
      capacity: Math.max(1, Math.floor(numberOr(opts.bufferCapacity, DEFAULTS.bufferCapacity))),
    });
  }

  accept(event: StructuredEvent): void {
    if (this.disposed || this.isOwnTransportEvent(event)) return;
    if (!shouldSample(event, { ratio: this.samplingRatio })) return;
    this.buffer.push(event);
    if (this.buffer.size() >= this.batchSize) {
      void this.flush("batch");
    }
  }

  start(): void {
    if (this.disposed) return;
    if (this.flushIntervalMs > 0 && typeof setInterval === "function") {
      this.timer = setInterval(() => {
        void this.flush("interval");
      }, this.flushIntervalMs);
    }

    const onUnload = () => {
      this.flushBeacon();
    };
    this.windowTarget?.addEventListener?.("pagehide", onUnload);
    this.windowTarget?.addEventListener?.("beforeunload", onUnload);
    this.teardown.push(() => this.windowTarget?.removeEventListener?.("pagehide", onUnload));
    this.teardown.push(() => this.windowTarget?.removeEventListener?.("beforeunload", onUnload));

    const onVisibility = () => {
      if (this.documentTarget?.visibilityState === "hidden") this.flushBeacon();
    };
    this.documentTarget?.addEventListener?.("visibilitychange", onVisibility);
    this.teardown.push(() => this.documentTarget?.removeEventListener?.("visibilitychange", onVisibility));
  }

  async flush(reason: FlushReason = "manual"): Promise<boolean> {
    if (this.disposed || this.inFlight || !this.fetchFn) return false;
    const now = this.now();
    if (reason !== "unload" && now < this.backoffUntil) return false;
    if (this.buffer.size() === 0) return true;

    const events = this.buffer.drain();
    const drained = this.buffer.droppedCount();
    this.droppedTotal += drained;
    const dropped = this.carriedDropped + drained;
    this.buffer.resetDropped();
    const payload = buildExternalEventsPayload(now, reason, events, dropped);

    this.inFlight = true;
    this.lastFlushAt = now;
    this.lastFlushReason = reason;
    this.lastFlushEvents = events.length;
    this.totalFlushes += 1;
    try {
      const res = await this.fetchFn(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      });
      if (!res.ok) throw new Error(`collector status ${res.status}`);
      this.failures = 0;
      this.backoffUntil = 0;
      this.carriedDropped = 0;
      this.lastFlushOk = true;
      this.lastFlushError = null;
      this.totalEventsSent += events.length;
      return true;
    } catch (err) {
      this.carriedDropped = dropped;
      this.failures += 1;
      const backoff = Math.min(
        this.maxBackoffMs,
        this.baseBackoffMs * 2 ** Math.max(0, this.failures - 1),
      );
      this.backoffUntil = now + backoff;
      this.lastFlushOk = false;
      this.lastFlushError = err instanceof Error ? err.message : String(err);
      this.requeueFront(events);
      return false;
    } finally {
      this.inFlight = false;
    }
  }

  flushBeacon(): boolean {
    if (this.disposed || this.buffer.size() === 0) return false;
    const sendBeacon = this.navigatorLike?.sendBeacon;
    if (typeof sendBeacon !== "function") return false;

    const events = this.buffer.drain();
    const drained = this.buffer.droppedCount();
    this.droppedTotal += drained;
    const dropped = this.carriedDropped + drained;
    this.buffer.resetDropped();
    const now = this.now();
    const payload = buildExternalEventsPayload(now, "unload", events, dropped);
    const ok = sendBeacon.call(this.navigatorLike, this.endpoint, JSON.stringify(payload));
    this.lastFlushAt = now;
    this.lastFlushReason = "unload";
    this.lastFlushEvents = events.length;
    this.totalFlushes += 1;
    if (ok) {
      this.failures = 0;
      this.backoffUntil = 0;
      this.carriedDropped = 0;
      this.lastFlushOk = true;
      this.lastFlushError = null;
      this.totalEventsSent += events.length;
      return true;
    }
    this.carriedDropped = dropped;
    this.lastFlushOk = false;
    this.lastFlushError = "sendBeacon returned false";
    this.requeueFront(events);
    return false;
  }

  diagnostics(): ExternalCollectorDiagnostics {
    const now = this.now();
    return {
      schemaVersion: 1,
      installed: !this.disposed,
      endpoint: this.endpoint,
      bufferSize: this.buffer.size(),
      bufferCapacity: this.buffer.getCapacity(),
      droppedTotal: this.droppedTotal + this.buffer.droppedCount(),
      inFlight: this.inFlight,
      failures: this.failures,
      backoffUntil: this.backoffUntil,
      backoffRemainingMs: Math.max(0, this.backoffUntil - now),
      lastFlushAt: this.lastFlushAt,
      lastFlushReason: this.lastFlushReason,
      lastFlushOk: this.lastFlushOk,
      lastFlushError: this.lastFlushError,
      lastFlushEvents: this.lastFlushEvents,
      totalFlushes: this.totalFlushes,
      totalEventsSent: this.totalEventsSent,
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
    for (const off of this.teardown.splice(0)) off();
  }

  private requeueFront(events: StructuredEvent[]): void {
    const current = this.buffer.drain();
    for (const event of events) this.buffer.push(event);
    for (const event of current) this.buffer.push(event);
  }

  private isOwnTransportEvent(event: StructuredEvent): boolean {
    if (!event.event.startsWith("sb.fetch.")) return false;
    const url = event.fields?.url;
    return typeof url === "string" && url === this.endpoint;
  }
}

export function installExternalEventSink(opts: ExternalEventSinkOptions = {}): () => void {
  if (installed) return installed.dispose;
  const endpoint = resolveEndpoint(opts.endpoint);
  if (!endpoint) return () => undefined;

  const sink = new ExternalEventSink({ ...opts, endpoint });
  const removeSink = addSink((event) => sink.accept(event));
  sink.start();

  const dispose = () => {
    removeSink();
    sink.dispose();
    if (installed?.dispose === dispose) installed = null;
  };
  installed = { dispose, sink };
  return dispose;
}

/** Retorna diagnóstico do coletor externo, ou `null` quando não instalado. */
export function getExternalCollectorDiagnostics(): ExternalCollectorDiagnostics | null {
  return installed ? installed.sink.diagnostics() : null;
}

/** Uso em testes. */
export function __uninstallExternalEventSinkForTests(): void {
  installed?.dispose();
  installed = null;
}

function resolveEndpoint(explicit: string | undefined): string | undefined {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  const endpoint = explicit ?? env?.VITE_OBSERVABILITY_ENDPOINT;
  const trimmed = endpoint?.trim();
  return trimmed ? trimmed : undefined;
}

function numberOr(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function defaultFetch(): FetchLike | undefined {
  return typeof fetch === "function" ? fetch.bind(globalThis) : undefined;
}

function defaultWindowTarget(): ListenerTargetLike | undefined {
  return typeof globalThis !== "undefined" ? (globalThis as ListenerTargetLike) : undefined;
}

function defaultDocumentTarget(): DocumentLike | undefined {
  return typeof document !== "undefined" ? (document as DocumentLike) : undefined;
}

function defaultNavigator(): NavigatorLike | undefined {
  return typeof navigator !== "undefined" ? (navigator as NavigatorLike) : undefined;
}