import { describe, it, expect, vi } from "vitest";
import { withDeadline, DeadlineExceededError, isDeadlineExceeded } from "../withDeadline";

describe("withDeadline", () => {
  it("resolve normalmente quando a promise conclui antes do prazo", async () => {
    const p = new Promise<string>((r) => setTimeout(() => r("ok"), 5));
    await expect(withDeadline(p, 100, "fast")).resolves.toBe("ok");
  });

  it("rejeita com DeadlineExceededError quando o prazo estoura", async () => {
    const p = new Promise<string>((r) => setTimeout(() => r("late"), 50));
    await expect(withDeadline(p, 10, "slow")).rejects.toBeInstanceOf(DeadlineExceededError);
  });

  it("preserva o erro original quando a promise rejeita antes do prazo", async () => {
    const boom = new Error("boom");
    const p = new Promise((_r, rej) => setTimeout(() => rej(boom), 5));
    await expect(withDeadline(p, 100, "reject")).rejects.toBe(boom);
  });

  it("dispara onTimeout quando estoura", async () => {
    const onTimeout = vi.fn();
    const p = new Promise((r) => setTimeout(r, 50));
    await withDeadline(p, 10, { label: "cb", onTimeout }).catch(() => {});
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it("ignora deadline não positivo", async () => {
    const p = Promise.resolve(42);
    await expect(withDeadline(p, 0, "noop")).resolves.toBe(42);
    await expect(withDeadline(p, -1, "noop")).resolves.toBe(42);
  });

  it("isDeadlineExceeded diferencia do resto", () => {
    expect(isDeadlineExceeded(new DeadlineExceededError("x", 1))).toBe(true);
    expect(isDeadlineExceeded(new Error("outro"))).toBe(false);
  });
});
