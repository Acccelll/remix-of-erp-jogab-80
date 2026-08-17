import { describe, expect, it } from "vitest";
import { hashKey, shouldSample } from "../sampling";
import type { StructuredEvent } from "../structured-logger";

function ev(over: Partial<StructuredEvent> = {}): StructuredEvent {
  return {
    ts: "2026-01-01T00:00:00.000Z",
    severity: "info",
    event: "sample.event",
    ...over,
  };
}

describe("hashKey", () => {
  it("é determinístico para a mesma entrada", () => {
    expect(hashKey("abc")).toBe(hashKey("abc"));
    expect(hashKey("abc")).not.toBe(hashKey("abd"));
  });
});

describe("shouldSample", () => {
  it("error/warn sempre passam, ignorando ratio", () => {
    expect(shouldSample(ev({ severity: "error" }), { ratio: 0 })).toBe(true);
    expect(shouldSample(ev({ severity: "warn" }), { ratio: 0 })).toBe(true);
  });

  it("ratio <= 0 bloqueia info/debug", () => {
    expect(shouldSample(ev(), { ratio: 0 })).toBe(false);
    expect(shouldSample(ev({ severity: "debug" }), { ratio: -1 })).toBe(false);
  });

  it("ratio >= 1 libera info/debug", () => {
    expect(shouldSample(ev(), { ratio: 1 })).toBe(true);
    expect(shouldSample(ev({ severity: "debug" }), { ratio: 2 })).toBe(true);
  });

  it("é estável por correlationId — todo o trace passa ou nenhum passa", () => {
    const cid = "cid-abc";
    const a = shouldSample(ev({ correlationId: cid, event: "a" }), { ratio: 0.5 });
    const b = shouldSample(ev({ correlationId: cid, event: "b" }), { ratio: 0.5 });
    expect(a).toBe(b);
  });

  it("aproxima a taxa configurada em amostra grande", () => {
    let passed = 0;
    const N = 2000;
    for (let i = 0; i < N; i++) {
      if (shouldSample(ev({ correlationId: `cid-${i}` }), { ratio: 0.25 })) passed++;
    }
    const rate = passed / N;
    expect(rate).toBeGreaterThan(0.18);
    expect(rate).toBeLessThan(0.32);
  });
});
