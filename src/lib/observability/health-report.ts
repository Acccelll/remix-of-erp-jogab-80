/** @module-kind pure */
/**
 * Payload agregado de saúde — OPS-004.slice-03
 *
 * Regra pura que compõe um relatório serializável a partir do
 * `FlowHealthRegistry`. Consumido pela superfície de monitor externo
 * (ex.: `/health`, `window.__planifikHealth()`).
 *
 * Formato estável — mudanças exigem bump de `schemaVersion`.
 */

import {
  type FlowHealthRegistry,
  type FlowSnapshot,
  type FlowStatus,
  flowHealth as defaultRegistry,
} from "./flow-health";

export interface HealthReport {
  schemaVersion: 1;
  generatedAt: string;
  status: FlowStatus;
  flows: HealthFlowEntry[];
  summary: Record<FlowStatus, number>;
}

export interface HealthFlowEntry {
  id: string;
  label: string;
  status: FlowStatus;
  consecutiveFailures: number;
  lastOkAt: string | null;
  lastFailAt: string | null;
  lastError: string | null;
}

function toIso(ms: number | undefined): string | null {
  return ms === undefined ? null : new Date(ms).toISOString();
}

function toEntry(s: FlowSnapshot): HealthFlowEntry {
  return {
    id: s.id,
    label: s.label,
    status: s.status,
    consecutiveFailures: s.consecutiveFailures,
    lastOkAt: toIso(s.lastOkAt),
    lastFailAt: toIso(s.lastFailAt),
    lastError: s.lastError ?? null,
  };
}

function emptySummary(): Record<FlowStatus, number> {
  return { unknown: 0, healthy: 0, degraded: 0, down: 0 };
}

export function buildHealthReport(
  now: number,
  registry: FlowHealthRegistry = defaultRegistry,
): HealthReport {
  const snap = registry.snapshot(now);
  const summary = emptySummary();
  for (const s of snap) summary[s.status] += 1;
  return {
    schemaVersion: 1,
    generatedAt: new Date(now).toISOString(),
    status: registry.overallHealth(now),
    flows: snap.map(toEntry),
    summary,
  };
}

/** HTTP-like status code para monitores externos. */
export function healthReportHttpStatus(report: HealthReport): 200 | 207 | 503 {
  if (report.status === "down") return 503;
  if (report.status === "healthy") return 200;
  return 207; // degraded/unknown — parcial
}
