/** @module-kind pure */
/**
 * Backoff exponencial com teto e jitter — Fase Offline (OFF.2).
 *
 * Curva: 5s, 15s, 45s, 2m, 5m, 10m (teto). Jitter de ±20 % evita "thundering
 * herd" quando vários itens falham juntos (ex.: rede caiu por 30s).
 *
 * Pura para ser testável sem clock real.
 */
export const BACKOFF_BASE_MS = 5_000;
export const BACKOFF_FACTOR = 3;
export const BACKOFF_MAX_MS = 10 * 60_000;

export function computeBackoffMs(attempts: number, rand: () => number = Math.random): number {
  const exp = Math.min(
    BACKOFF_MAX_MS,
    BACKOFF_BASE_MS * Math.pow(BACKOFF_FACTOR, Math.max(0, attempts - 1)),
  );
  // Jitter ±20%.
  const jitter = 1 + (rand() - 0.5) * 0.4;
  return Math.round(exp * jitter);
}

export function nextAttemptAt(
  attempts: number,
  now: number = Date.now(),
  rand?: () => number,
): number {
  return now + computeBackoffMs(attempts, rand);
}
