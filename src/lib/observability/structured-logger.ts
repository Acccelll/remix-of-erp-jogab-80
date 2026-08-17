/** @module-kind pure */
/**
 * Logger estruturado — OPS-003.slice-01
 *
 * Emite eventos com formato canônico:
 *   { ts, severity, event, correlationId?, ...fields }
 *
 * A serialização é sempre JSON de uma linha, o que permite ingestão
 * por qualquer pipeline (Sentry breadcrumb, console, ou coletor
 * externo em slice-03).
 *
 * Contrato:
 * - Não substitui `logger.*` (mensagens livres continuam permitidas).
 * - Não faz I/O além de `console.*` e do `sink` opcional.
 * - `severity` padronizada (debug|info|warn|error).
 * - `event` é um nome estável (ex.: "auth.login.ok").
 * - `correlationId` vem do módulo de correlação se não informado.
 */

import { getCorrelationId } from "./correlation";

export type Severity = "debug" | "info" | "warn" | "error";

export interface StructuredEvent {
  ts: string;
  severity: Severity;
  event: string;
  correlationId?: string;
  fields?: Record<string, unknown>;
}

export interface EmitOptions {
  correlationId?: string;
  fields?: Record<string, unknown>;
}

type Sink = (evt: StructuredEvent) => void;

const sinks: Sink[] = [];

export function addSink(sink: Sink): () => void {
  sinks.push(sink);
  return () => {
    const i = sinks.indexOf(sink);
    if (i >= 0) sinks.splice(i, 1);
  };
}

export function __resetSinksForTests(): void {
  sinks.length = 0;
}

function nowIso(): string {
  return new Date().toISOString();
}

function safeFields(
  fields: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!fields) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v instanceof Error) {
      out[k] = { name: v.name, message: v.message };
    } else if (
      v === null ||
      typeof v === "string" ||
      typeof v === "number" ||
      typeof v === "boolean"
    ) {
      out[k] = v;
    } else {
      // Serializa best-effort; se falhar, marca como não-serializável.
      try {
        out[k] = JSON.parse(JSON.stringify(v));
      } catch {
        out[k] = "[unserializable]";
      }
    }
  }
  return out;
}

export function emit(
  severity: Severity,
  event: string,
  opts: EmitOptions = {},
): StructuredEvent {
  const evt: StructuredEvent = {
    ts: nowIso(),
    severity,
    event,
    correlationId: opts.correlationId ?? getCorrelationId(),
    fields: safeFields(opts.fields),
  };
  for (const s of sinks) {
    try {
      s(evt);
    } catch {
      // Um sink com defeito não deve derrubar o caller.
    }
  }
  return evt;
}

export const structured = {
  debug: (event: string, opts?: EmitOptions) => emit("debug", event, opts),
  info: (event: string, opts?: EmitOptions) => emit("info", event, opts),
  warn: (event: string, opts?: EmitOptions) => emit("warn", event, opts),
  error: (event: string, opts?: EmitOptions) => emit("error", event, opts),
};
