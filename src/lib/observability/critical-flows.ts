/** @module-kind orchestration */
/**
 * Fluxos críticos monitorados — OPS-004.slice-02
 *
 * Centraliza os IDs estáveis e os pontos de marcação usados pelos
 * call-sites reais. O registry (`flowHealth`) continua puro; este arquivo
 * é a borda que injeta `Date.now()` e também emite eventos estruturados.
 */

import { flowHealth } from "./flow-health";
import { structured } from "./structured-logger";

export const criticalFlowIds = {
  totvsImport: "totvs.import",
  obraSync: "obra.sync",
  offlineQueue: "offline.queue",
} as const;

export type CriticalFlowId = (typeof criticalFlowIds)[keyof typeof criticalFlowIds];

const DAY_MS = 24 * 60 * 60 * 1000;

const CRITICAL_FLOW_DEFS = [
  {
    id: criticalFlowIds.totvsImport,
    label: "Importação TOTVS",
    failThreshold: 2,
    staleAfterMs: 32 * DAY_MS,
  },
  {
    id: criticalFlowIds.obraSync,
    label: "Sync de Obra",
    failThreshold: 3,
    staleAfterMs: DAY_MS,
  },
  {
    id: criticalFlowIds.offlineQueue,
    label: "Fila offline",
    failThreshold: 2,
    staleAfterMs: 60 * 60 * 1000,
  },
] as const;

let registered = false;

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function registerCriticalFlows(): void {
  if (registered) return;
  registered = true;
  for (const def of CRITICAL_FLOW_DEFS) flowHealth.register(def);
}

export function noteCriticalFlowOk(
  id: CriticalFlowId,
  fields: Record<string, unknown> = {},
): void {
  registerCriticalFlows();
  flowHealth.noteOk(id, Date.now());
  structured.info("flow.health.ok", { fields: { flowId: id, ...fields } });
}

export function noteCriticalFlowFail(
  id: CriticalFlowId,
  err: unknown,
  fields: Record<string, unknown> = {},
): void {
  registerCriticalFlows();
  const error = errorMessage(err);
  flowHealth.noteFail(id, Date.now(), error);
  structured.warn("flow.health.fail", { fields: { flowId: id, error, ...fields } });
}

export async function observeCriticalFlow<T>(
  id: CriticalFlowId,
  fn: () => Promise<T>,
  fields: Record<string, unknown> = {},
): Promise<T> {
  try {
    const result = await fn();
    noteCriticalFlowOk(id, fields);
    return result;
  } catch (err) {
    noteCriticalFlowFail(id, err, fields);
    throw err;
  }
}

/** Uso em testes. */
export function __resetCriticalFlowsForTests(): void {
  registered = false;
  flowHealth.reset();
}