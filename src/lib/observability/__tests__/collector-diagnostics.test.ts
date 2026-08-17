import { describe, expect, it, vi } from "vitest";
import { ExternalEventSink } from "../event-collector";
import type { Severity, StructuredEvent } from "../structured-logger";

const ENDPOINT = "https://collector.example/events";
const T0 = Date.UTC(2026, 0, 1, 12, 0, 0);

function ev(n: number, severity: Severity = "error"): StructuredEvent {
  return {
    ts: "2026-01-01T00:00:00.000Z",
    severity,
    event: `e-${n}`,
    correlationId: `cid-${n}`,
  };
}

function makeSink(fetchFn: ReturnType<typeof vi.fn>, now: () => number) {
  return new ExternalEventSink({
    endpoint: ENDPOINT,
    samplingRatio: 1,
    batchSize: 100,
    flushIntervalMs: 0,
    baseBackoffMs: 1_000,
    maxBackoffMs: 30_000,
    bufferCapacity: 2,
    fetchFn,
    now,
    windowTarget: undefined,
    documentTarget: undefined,
    navigatorLike: undefined,
  });
}

describe("ExternalEventSink.diagnostics", () => {
  it("reporta estado inicial vazio", () => {
    const sink = makeSink(vi.fn(), () => T0);
    const d = sink.diagnostics();
    expect(d).toMatchObject({
      schemaVersion: 1,
      installed: true,
      endpoint: ENDPOINT,
      bufferSize: 0,
      bufferCapacity: 2,
      droppedTotal: 0,
      inFlight: false,
      failures: 0,
      backoffUntil: 0,
      backoffRemainingMs: 0,
      lastFlushAt: null,
      lastFlushReason: null,
      lastFlushOk: null,
      lastFlushError: null,
      lastFlushEvents: 0,
      totalFlushes: 0,
      totalEventsSent: 0,
    });
  });

  it("contabiliza flush bem-sucedido", async () => {
    const fetchFn = vi.fn(async () => new Response("", { status: 200 }));
    const sink = makeSink(fetchFn, () => T0);
    sink.accept(ev(1));
    sink.accept(ev(2));
    await sink.flush("manual");
    const d = sink.diagnostics();
    expect(d.totalFlushes).toBe(1);
    expect(d.totalEventsSent).toBe(2);
    expect(d.lastFlushOk).toBe(true);
    expect(d.lastFlushReason).toBe("manual");
    expect(d.lastFlushEvents).toBe(2);
    expect(d.failures).toBe(0);
    expect(d.bufferSize).toBe(0);
  });

  it("registra falha, erro e backoff", async () => {
    const fetchFn = vi.fn(async () => new Response("", { status: 500 }));
    let t = T0;
    const sink = makeSink(fetchFn, () => t);
    sink.accept(ev(1));
    await sink.flush("manual");
    t += 100;
    const d = sink.diagnostics();
    expect(d.lastFlushOk).toBe(false);
    expect(d.failures).toBe(1);
    expect(d.lastFlushError).toContain("500");
    expect(d.backoffUntil).toBe(T0 + 1_000);
    expect(d.backoffRemainingMs).toBe(900);
    expect(d.bufferSize).toBe(1); // requeued
  });

  it("acumula droppedTotal com overflow do buffer", () => {
    const sink = makeSink(vi.fn(), () => T0);
    sink.accept(ev(1));
    sink.accept(ev(2));
    sink.accept(ev(3)); // overflow -> drop 1
    sink.accept(ev(4)); // overflow -> drop 1
    expect(sink.diagnostics().droppedTotal).toBe(2);
  });
});
