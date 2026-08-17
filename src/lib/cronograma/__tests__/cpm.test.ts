import { describe, it, expect } from "vitest";
import { computeCpm } from "@/lib/cronograma/cpm";

describe("computeCpm", () => {
  it("calcula folga zero para itens com baseline e fim alinhados (sem off-by-one por timezone)", () => {
    const itens = [
      { id: "a", uid_mpp: "1", data_inicio: "2025-06-01", data_fim: "2025-06-05" },
      { id: "b", uid_mpp: "2", data_inicio: "2025-06-06", data_fim: "2025-06-10" },
    ];
    const deps = [{ item_id: "b", predecessor_uid_mpp: "1", tipo: "FS" as const, lag_dias: 0 }];
    const r = computeCpm(itens, deps);
    // Ambas críticas (sem folga)
    expect(r.find((x) => x.id === "a")?.folga_dias).toBe(0);
    expect(r.find((x) => x.id === "b")?.folga_dias).toBe(0);
    expect(r.every((x) => x.critico)).toBe(true);
  });

  it("identifica item com folga", () => {
    const itens = [
      { id: "a", uid_mpp: "1", data_inicio: "2025-06-01", data_fim: "2025-06-05" },
      { id: "b", uid_mpp: "2", data_inicio: "2025-06-15", data_fim: "2025-06-20" },
    ];
    const deps = [{ item_id: "b", predecessor_uid_mpp: "1", tipo: "FS" as const, lag_dias: 0 }];
    const r = computeCpm(itens, deps);
    const a = r.find((x) => x.id === "a")!;
    expect(a.folga_dias).toBeGreaterThan(0);
    expect(a.critico).toBe(false);
  });
});
