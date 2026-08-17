import { describe, it, expect } from "vitest";
import { computeBackoffMs, nextAttemptAt, BACKOFF_MAX_MS } from "../backoff";

describe("computeBackoffMs", () => {
  const fixedRand = () => 0.5; // jitter neutro (fator 1.0)

  it("primeira tentativa ≈ 5s", () => {
    expect(computeBackoffMs(1, fixedRand)).toBe(5_000);
  });

  it("cresce exponencialmente", () => {
    expect(computeBackoffMs(2, fixedRand)).toBe(15_000);
    expect(computeBackoffMs(3, fixedRand)).toBe(45_000);
    expect(computeBackoffMs(4, fixedRand)).toBe(135_000);
  });

  it("respeita o teto", () => {
    expect(computeBackoffMs(20, fixedRand)).toBe(BACKOFF_MAX_MS);
  });

  it("aplica jitter ±20%", () => {
    const low = computeBackoffMs(1, () => 0); // -20%
    const high = computeBackoffMs(1, () => 1); // +20%
    expect(low).toBeLessThan(5_000);
    expect(high).toBeGreaterThan(5_000);
    expect(low).toBeGreaterThanOrEqual(4_000);
    expect(high).toBeLessThanOrEqual(6_000);
  });

  it("nextAttemptAt soma agora + backoff", () => {
    const now = 1_000_000;
    expect(nextAttemptAt(1, now, fixedRand)).toBe(now + 5_000);
  });
});
