/** @module-kind pure */
/**
 * Amostragem determinística de eventos estruturados — OPS-005.slice-01
 *
 * Decide se um evento deve ser exportado a um coletor externo, sem I/O
 * e sem `Math.random()` — usamos um hash estável do `correlationId`
 * (ou fallback pelo `event`) para que uma mesma correlação sobreviva
 * inteira à amostragem (todos os spans do trace passam ou nenhum passa).
 *
 * Regras por severidade:
 * - `error` / `warn`: sempre passam (ratio ignorado).
 * - `info`  / `debug`: sujeitos ao ratio [0..1].
 *   - ratio <= 0 → nunca passa.
 *   - ratio >= 1 → sempre passa.
 */

import type { StructuredEvent } from "./structured-logger";

export interface SamplingPolicy {
  /** Fração [0..1] de eventos info/debug que serão exportados. */
  ratio: number;
}

/** FNV-1a 32-bit — determinístico e barato, suficiente para amostragem. */
export function hashKey(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

export function shouldSample(
  event: Pick<StructuredEvent, "severity" | "event" | "correlationId">,
  policy: SamplingPolicy,
): boolean {
  if (event.severity === "error" || event.severity === "warn") return true;
  const ratio = policy.ratio;
  if (!(ratio > 0)) return false;
  if (ratio >= 1) return true;
  const key = event.correlationId ?? event.event;
  const bucket = hashKey(key) / 0xffffffff;
  return bucket < ratio;
}
