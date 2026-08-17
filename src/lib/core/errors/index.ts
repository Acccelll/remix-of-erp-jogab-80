/** @module-kind pure */
/**
 * Política única de tratamento de erros (Achado QC-003).
 *
 * Regras (Contrato de Execução):
 * - **Silêncio total é proibido.** Nenhum `catch {}` vazio.
 * - Erros devem ir para um dos três destinos, com intenção explícita:
 *
 *   1. `reportError(scope, err, meta?)` — falha inesperada; loga (dev) e
 *      encaminha para telemetria (Sentry) quando disponível.
 *   2. `swallow(scope, err, reason)` — falha esperada e ignorável por
 *      _design_ (ex.: storage local bloqueado, parse defensivo). O
 *      `reason` documenta a decisão e o log fica em dev.
 *   3. `toast.error(...)` — falha que precisa ser comunicada ao usuário.
 *      Fica a cargo do chamador; esta camada não emite UI.
 *
 * A ponte real com o Sentry (ou equivalente) é injetada em
 * `setErrorTelemetry`. Enquanto não houver telemetria configurada,
 * o `reportError` roteia via `logger.error` (Sentry.io capta warn+error
 * do console quando o SDK está instalado — comportamento padrão).
 */

import { logger } from "@/lib/core/logger";

export type ErrorMeta = Record<string, unknown>;

type Telemetry = (scope: string, err: unknown, meta?: ErrorMeta) => void;

let telemetry: Telemetry | null = null;

/** Injeta o transporte de telemetria (Sentry etc.). Idempotente. */
export function setErrorTelemetry(fn: Telemetry | null) {
  telemetry = fn;
}

/**
 * Reporta falha inesperada.
 * - Sempre loga via `logger.error` (Sentry SDK captura automaticamente).
 * - Encaminha ao transporte, se configurado.
 */
export function reportError(scope: string, err: unknown, meta?: ErrorMeta) {
  logger.error(`[${scope}]`, err, meta ?? {});
  try {
    telemetry?.(scope, err, meta);
  } catch (telemetryErr) {
    logger.warn("[errors] telemetria falhou", telemetryErr);
  }
}

/**
 * Falha esperada e ignorável — só é chamada em `catch` que substituem
 * `catch {}`. O `reason` documenta por que a exceção é aceitável.
 * Em produção não emite ruído; em desenvolvimento loga em `debug`.
 */
export function swallow(scope: string, err: unknown, reason: string) {
  logger.debug(`[${scope}] ignorado (${reason})`, err);
}
