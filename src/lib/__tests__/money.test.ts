import { describe, it, expect } from "vitest";
import { round2, round4, sumMoney } from "@/lib/core/money";

describe("money helpers", () => {
  it("round2 arredonda half-away-from-zero", () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.675)).toBe(2.68);
    expect(round2(null)).toBe(0);
    expect(round2("3.14159")).toBe(3.14);
  });

  it("round4 mantém 4 casas", () => {
    expect(round4(0.123456)).toBe(0.1235);
  });

  it("sumMoney soma e arredonda", () => {
    const items = [{ v: 1.005 }, { v: 2.005 }, { v: 0.99 }];
    expect(sumMoney(items, (i) => i.v)).toBe(4.0);
    expect(sumMoney(null, () => 1)).toBe(0);
  });
});
