/** @module-kind pure */
/**
 * Logger fino — wrapper sobre `console.*` que silencia debug/info em produção
 * (mantém warn/error). Para mensagens visíveis ao usuário, use `toast`.
 *
 * Sink opcional para telemetria (Sentry) é injetado via `setLoggerErrorSink`
 * — a camada pura não depende do SDK; o bootstrap de observabilidade
 * conecta o transporte real (QC-003 slice-02).
 */

const isDev =
  typeof import.meta !== "undefined" &&
  Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV);

type ErrorSink = (args: unknown[]) => void;

let errorSink: ErrorSink | null = null;

/** Injeta o transporte de erro (ex.: Sentry). Idempotente. */
export function setLoggerErrorSink(sink: ErrorSink | null) {
  errorSink = sink;
}

export const logger = {
  debug: (...args: unknown[]) => {
    if (isDev) console.debug(...args);
  },
  info: (...args: unknown[]) => {
    if (isDev) console.info(...args);
  },
  warn: (...args: unknown[]) => {
    console.warn(...args);
  },
  error: (...args: unknown[]) => {
    console.error(...args);
    if (errorSink) {
      try {
        errorSink(args);
      } catch {
        // Sink não pode derrubar o fluxo do chamador.
      }
    }
  },
};
