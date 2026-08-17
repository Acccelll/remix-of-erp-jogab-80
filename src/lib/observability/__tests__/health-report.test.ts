import { describe, expect, it } from "vitest";
import { FlowHealthRegistry } from "../flow-health";
import { buildHealthReport, healthReportHttpStatus } from "../health-report";

const T0 = Date.UTC(2026, 0, 1, 12, 0, 0);

function freshRegistry(): FlowHealthRegistry {
  const r = new FlowHealthRegistry();
  r.register({ id: "a", label: "A", failThreshold: 2, staleAfterMs: 60_000 });
  r.register({ id: "b", label: "B", failThreshold: 2, staleAfterMs: 60_000 });
  return r;
}

describe("buildHealthReport", () => {
  it("retorna schema estável e summary zerado quando tudo unknown", () => {
    const r = freshRegistry();
    const report = buildHealthReport(T0, r);
    expect(report.schemaVersion).toBe(1);
    expect(report.status).toBe("unknown");
    expect(report.generatedAt).toBe(new Date(T0).toISOString());
    expect(report.flows).toHaveLength(2);
    expect(report.summary).toEqual({ unknown: 2, healthy: 0, degraded: 0, down: 0 });
    expect(report.flows[0]).toEqual({
      id: "a",
      label: "A",
      status: "unknown",
      consecutiveFailures: 0,
      lastOkAt: null,
      lastFailAt: null,
      lastError: null,
    });
  });

  it("serializa lastOk/lastFail como ISO e propaga lastError", () => {
    const r = freshRegistry();
    r.noteOk("a", T0);
    r.noteFail("b", T0 + 1000, "boom");
    const report = buildHealthReport(T0 + 2000, r);
    const a = report.flows.find((f) => f.id === "a");
    const b = report.flows.find((f) => f.id === "b");
    expect(a?.lastOkAt).toBe(new Date(T0).toISOString());
    expect(b?.lastFailAt).toBe(new Date(T0 + 1000).toISOString());
    expect(b?.lastError).toBe("boom");
    expect(report.status).toBe("degraded");
    expect(report.summary).toEqual({ unknown: 0, healthy: 1, degraded: 1, down: 0 });
  });

  it("marca down quando threshold estourado e refletido no summary", () => {
    const r = freshRegistry();
    r.noteFail("a", T0, "x");
    r.noteFail("a", T0 + 100, "x");
    const report = buildHealthReport(T0 + 200, r);
    expect(report.status).toBe("down");
    expect(report.summary.down).toBe(1);
  });
});

describe("healthReportHttpStatus", () => {
  it("mapeia healthy→200, degraded/unknown→207, down→503", () => {
    const r = freshRegistry();
    expect(healthReportHttpStatus(buildHealthReport(T0, r))).toBe(207);
    r.noteOk("a", T0);
    r.noteOk("b", T0);
    expect(healthReportHttpStatus(buildHealthReport(T0, r))).toBe(200);
    r.noteFail("a", T0, "x");
    r.noteFail("a", T0, "x");
    expect(healthReportHttpStatus(buildHealthReport(T0, r))).toBe(503);
  });
});
