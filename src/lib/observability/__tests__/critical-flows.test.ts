import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { flowHealth } from "../flow-health";
import {
  __resetCriticalFlowsForTests,
  criticalFlowIds,
  observeCriticalFlow,
  registerCriticalFlows,
} from "../critical-flows";
import { __resetSinksForTests, addSink, type StructuredEvent } from "../structured-logger";

const T0 = 1_700_000_000_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  __resetCriticalFlowsForTests();
  __resetSinksForTests();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("critical flows", () => {
  it("registra os fluxos críticos conhecidos", () => {
    registerCriticalFlows();

    const ids = flowHealth.snapshot(T0).map((s) => s.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        criticalFlowIds.totvsImport,
        criticalFlowIds.obraSync,
        criticalFlowIds.offlineQueue,
      ]),
    );
  });

  it("observeCriticalFlow marca sucesso e emite evento estruturado", async () => {
    const events: StructuredEvent[] = [];
    addSink((e) => events.push(e));

    const result = await observeCriticalFlow(criticalFlowIds.obraSync, async () => "ok", {
      obraId: "obra-1",
    });

    const snap = flowHealth.snapshot(T0).find((s) => s.id === criticalFlowIds.obraSync)!;
    expect(result).toBe("ok");
    expect(snap.status).toBe("healthy");
    expect(events.at(-1)?.event).toBe("flow.health.ok");
    expect(events.at(-1)?.fields).toMatchObject({ flowId: criticalFlowIds.obraSync, obraId: "obra-1" });
  });

  it("observeCriticalFlow marca falha, preserva erro e relança", async () => {
    const events: StructuredEvent[] = [];
    addSink((e) => events.push(e));

    await expect(
      observeCriticalFlow(criticalFlowIds.totvsImport, async () => {
        throw new Error("timeout");
      }),
    ).rejects.toThrow("timeout");

    const snap = flowHealth.snapshot(T0).find((s) => s.id === criticalFlowIds.totvsImport)!;
    expect(snap.status).toBe("degraded");
    expect(snap.lastError).toBe("timeout");
    expect(events.at(-1)?.event).toBe("flow.health.fail");
    expect(events.at(-1)?.fields).toMatchObject({ flowId: criticalFlowIds.totvsImport, error: "timeout" });
  });
});