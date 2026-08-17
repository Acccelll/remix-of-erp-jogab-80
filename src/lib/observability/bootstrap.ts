/** @module-kind io */
/**
 * Bootstrap de observabilidade — OPS-003.slice-02
 *
 * Plugará os sinks do `structured-logger` conforme o ambiente:
 * - Console em dev (linha JSON legível para inspeção).
 * - Sentry breadcrumb em produção (quando `initSentry` estiver ativo),
 *   preservando `correlationId` como campo do breadcrumb.
 *
 * Idempotente: chamar múltiplas vezes não empilha sinks.
 */

import { addSink, type StructuredEvent } from "./structured-logger";
import { installFetchInterceptor } from "./fetch-interceptor";
import { registerCriticalFlows } from "./critical-flows";
import { buildHealthReport, healthReportHttpStatus } from "./health-report";
import {
  getExternalCollectorDiagnostics,
  installExternalEventSink,
  type ExternalCollectorDiagnostics,
} from "./event-collector";
import { isSentryEnabled, Sentry, captureException } from "@/lib/sentry";
import { setLoggerErrorSink } from "@/lib/core/logger";

let installed = false;
const removers: Array<() => void> = [];

function severityToSentryLevel(
  s: StructuredEvent["severity"],
): "debug" | "info" | "warning" | "error" {
  return s === "warn" ? "warning" : s;
}

function isDev(): boolean {
  return Boolean(
    (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV,
  );
}

export function installObservabilitySinks(): void {
  if (installed) return;
  installed = true;

  // OPS-003.slice-03: propagação de X-Correlation-Id em chamadas Supabase/edge.
  installFetchInterceptor();
  // OPS-004.slice-02: fluxos críticos conhecidos pelo health registry.
  registerCriticalFlows();
  // OPS-004.slice-03: superfície consumível por monitor externo.
  installHealthSurface();
  // OPS-005.slice-02: exportador externo; no-op quando endpoint não está configurado.
  removers.push(installExternalEventSink());

  if (isDev()) {
    removers.push(
      addSink((e) => {
        // JSON de uma linha — grep-friendly no console do dev tools.
        console.debug("[evt]", JSON.stringify(e));
      }),
    );
  }

  if (isSentryEnabled()) {
    removers.push(
      addSink((e) => {
        Sentry.addBreadcrumb({
          category: "evt",
          message: e.event,
          level: severityToSentryLevel(e.severity),
          timestamp: new Date(e.ts).getTime() / 1000,
          data: {
            ...(e.fields ?? {}),
            ...(e.correlationId ? { correlationId: e.correlationId } : {}),
          },
        });
      }),
    );

    // QC-003 slice-02: encaminha logger.error → Sentry.captureException.
    setLoggerErrorSink((args) => {
      const err = args.find((a) => a instanceof Error);
      const extra = { args: args.map((a) => (a instanceof Error ? a.message : a)) };
      if (err) {
        captureException(err, extra);
      } else {
        captureException(new Error(args.map((a) => String(a)).join(" ")), extra);
      }
    });
    removers.push(() => setLoggerErrorSink(null));
  }
}

interface HealthWindow {
  __planifikHealth?: () => ReturnType<typeof buildHealthReport>;
  __planifikHealthHttpStatus?: () => number;
  __planifikCollector?: () => ExternalCollectorDiagnostics | null;
}

function installHealthSurface(): void {
  if (typeof globalThis === "undefined") return;
  const w = globalThis as unknown as HealthWindow;
  w.__planifikHealth = () => buildHealthReport(Date.now());
  w.__planifikHealthHttpStatus = () =>
    healthReportHttpStatus(buildHealthReport(Date.now()));
  // OPS-005.slice-03: superfície diagnóstica do coletor externo.
  w.__planifikCollector = () => getExternalCollectorDiagnostics();
}

/** Uso em testes. */
export function __uninstallObservabilitySinksForTests(): void {
  for (const r of removers) r();
  removers.length = 0;
  installed = false;
}
