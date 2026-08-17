/** @module-kind io */
/**
 * Alerta de degradação de performance por RPC.
 *
 * Mantém baseline móvel (EWMA) de p95 por queryid em localStorage e dispara
 * `logger.warn` (roteado ao Sentry) quando o p95 atual > `factor` × baseline.
 *
 * Consumidor: `/gm/saude` — apenas GM roda essa checagem.
 */
import { logger } from "@/lib/core/logger";
import { STORAGE_KEYS } from "@/lib/core/storage/keys";
import { swallow } from "@/lib/core/errors";

const STORAGE_KEY = STORAGE_KEYS.rpcP95Baseline;
const EWMA_ALPHA = 0.2; // peso da amostra nova
const DEFAULT_FACTOR = 2; // gatilho: 2× baseline
const MIN_MS = 25; // ignora ruído sub-25ms
const COOLDOWN_MS = 15 * 60 * 1000; // 15 min entre alertas por query

type BaselineEntry = { p95: number; lastAlertAt: number };
type BaselineMap = Record<string, BaselineEntry>;

function readMap(): BaselineMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as BaselineMap) : {};
  } catch {
    return {};
  }
}

function writeMap(m: BaselineMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(m));
  } catch {
    /* quota — ignora */
  }
}

export interface RpcSample {
  queryid: number | string | null;
  p95_ms: number | null;
  mean_ms?: number | null;
  categoria?: string | null;
  statement?: string | null;
}

export function checkRpcDegradation(samples: RpcSample[], factor = DEFAULT_FACTOR) {
  const map = readMap();
  const now = Date.now();
  const alerts: Array<{
    queryid: string;
    p95: number;
    baseline: number;
    categoria: string | null;
  }> = [];

  for (const s of samples) {
    if (s.queryid == null) continue;
    const p95 = Number(s.p95_ms ?? 0);
    if (!Number.isFinite(p95) || p95 < MIN_MS) continue;

    const key = String(s.queryid);
    const prev = map[key];

    if (!prev) {
      map[key] = { p95, lastAlertAt: 0 };
      continue;
    }

    if (p95 > prev.p95 * factor && now - prev.lastAlertAt > COOLDOWN_MS) {
      alerts.push({ queryid: key, p95, baseline: prev.p95, categoria: s.categoria ?? null });
      logger.warn("rpc_p95_degradation", {
        queryid: key,
        categoria: s.categoria ?? null,
        p95_ms: p95,
        baseline_ms: Math.round(prev.p95),
        factor: Number((p95 / prev.p95).toFixed(2)),
        statement: (s.statement ?? "").slice(0, 140),
      });
      prev.lastAlertAt = now;
    }

    // Atualiza baseline com EWMA (só quando não é surto extremo, evita mover a régua).
    if (p95 < prev.p95 * factor) {
      prev.p95 = EWMA_ALPHA * p95 + (1 - EWMA_ALPHA) * prev.p95;
    }
  }

  writeMap(map);
  return alerts;
}

export function resetRpcBaseline() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    swallow("rpc-baseline.reset", err, "storage indisponível");
  }
}
