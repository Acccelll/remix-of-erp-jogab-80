/** @module-kind io */
/**
 * fetchWithRetry — wrapper para chamadas HTTP externas (H2.3).
 * Timeout + retry com backoff exponencial; loga falha no logger
 * estruturado (que encaminha pro Sentry quando configurado).
 */
import { logger } from "@/lib/core/logger";

export interface RetryOptions {
  /** Timeout por tentativa em ms (default 15000). */
  timeoutMs?: number;
  /** Tentativas máximas, incluindo a primeira (default 3). */
  maxAttempts?: number;
  /** Base do backoff em ms (default 500). Delay = base * 2^(n-1). */
  backoffMs?: number;
  /** Status HTTP que devem disparar retry (default 5xx + 408 + 429). */
  retryOn?: (status: number) => boolean;
  /** Rótulo para o log (ex.: "planifik.api"). */
  label?: string;
}

const defaultRetryOn = (status: number) => status === 408 || status === 429 || status >= 500;

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit = {},
  opts: RetryOptions = {},
): Promise<Response> {
  const {
    timeoutMs = 15000,
    maxAttempts = 3,
    backoffMs = 500,
    retryOn = defaultRetryOn,
    label = "fetch",
  } = opts;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(input, { ...init, signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok && retryOn(res.status) && attempt < maxAttempts) {
        logger.warn(`${label} retry`, { attempt, status: res.status });
        await delay(backoffMs * 2 ** (attempt - 1));
        continue;
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (attempt < maxAttempts) {
        logger.warn(`${label} retry`, { attempt, error: String(err) });
        await delay(backoffMs * 2 ** (attempt - 1));
        continue;
      }
      logger.error(`${label} falhou após ${maxAttempts} tentativas`, { error: String(err) });
      throw err;
    }
  }
  throw lastErr ?? new Error(`${label}: esgotou tentativas`);
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
