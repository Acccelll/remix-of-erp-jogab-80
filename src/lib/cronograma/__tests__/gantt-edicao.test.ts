import { describe, it, expect } from "vitest";
import {
  aplicarDrag,
  aplicarResize,
  validarNovaDependencia,
  pxToDias,
  calcularCascata,
} from "../gantt-edicao";

describe("aplicarDrag", () => {
  it("desloca início e fim pelo mesmo delta", () => {
    const r = aplicarDrag({ data_inicio: "2026-06-01", data_fim: "2026-06-10" }, 3);
    expect(r).toEqual({ data_inicio: "2026-06-04", data_fim: "2026-06-13" });
  });
  it("aceita delta negativo", () => {
    const r = aplicarDrag({ data_inicio: "2026-06-10", data_fim: "2026-06-20" }, -5);
    expect(r).toEqual({ data_inicio: "2026-06-05", data_fim: "2026-06-15" });
  });
});

describe("aplicarResize", () => {
  it("redimensiona borda fim normalmente", () => {
    const r = aplicarResize({ data_inicio: "2026-06-01", data_fim: "2026-06-10" }, "fim", 5);
    expect(r).toEqual({ data_inicio: "2026-06-01", data_fim: "2026-06-15" });
  });
  it("redimensiona borda inicio normalmente", () => {
    const r = aplicarResize({ data_inicio: "2026-06-01", data_fim: "2026-06-10" }, "inicio", -2);
    expect(r).toEqual({ data_inicio: "2026-05-30", data_fim: "2026-06-10" });
  });
  it("não permite que início ultrapasse o fim", () => {
    const r = aplicarResize({ data_inicio: "2026-06-01", data_fim: "2026-06-05" }, "inicio", 30);
    expect(r.data_inicio).toBe(r.data_fim); // colapsa em 1 dia
  });
  it("não permite que fim recue antes do início", () => {
    const r = aplicarResize({ data_inicio: "2026-06-05", data_fim: "2026-06-10" }, "fim", -30);
    expect(r.data_fim).toBe(r.data_inicio);
  });
});

describe("validarNovaDependencia", () => {
  it("recusa auto-ligação", () => {
    expect(validarNovaDependencia([], "A", "A")).toEqual({ ok: false, motivo: "self" });
  });
  it("recusa duplicata", () => {
    const deps = [{ predecessor_item_id: "A", item_id: "B" }];
    expect(validarNovaDependencia(deps, "A", "B")).toEqual({ ok: false, motivo: "duplicata" });
  });
  it("aceita aresta inédita", () => {
    const deps = [{ predecessor_item_id: "A", item_id: "B" }];
    expect(validarNovaDependencia(deps, "B", "C")).toEqual({ ok: true });
  });
  it("recusa ciclo direto", () => {
    const deps = [{ predecessor_item_id: "A", item_id: "B" }];
    // tentar B → A fecha ciclo
    expect(validarNovaDependencia(deps, "B", "A")).toEqual({ ok: false, motivo: "ciclo" });
  });
  it("recusa ciclo transitivo", () => {
    const deps = [
      { predecessor_item_id: "A", item_id: "B" },
      { predecessor_item_id: "B", item_id: "C" },
    ];
    // C → A fecharia A→B→C→A
    expect(validarNovaDependencia(deps, "C", "A")).toEqual({ ok: false, motivo: "ciclo" });
  });
});

describe("pxToDias", () => {
  it("arredonda para inteiro", () => {
    expect(pxToDias(28, 14)).toBe(2);
    expect(pxToDias(20, 14)).toBe(1);
    expect(pxToDias(7, 14)).toBe(1); // 0.5 arredonda pra cima
    expect(pxToDias(-21, 14)).toBe(-1); // Math.round(-1.5) === -1 (round half toward +∞)
  });
  it("devolve 0 quando dayPx inválido", () => {
    expect(pxToDias(50, 0)).toBe(0);
  });
});

describe("calcularCascata", () => {
  const itens = [
    { id: "A", data_inicio: "2026-06-01", data_fim: "2026-06-05" },
    { id: "B", data_inicio: "2026-06-06", data_fim: "2026-06-10" },
    { id: "C", data_inicio: "2026-06-11", data_fim: "2026-06-15" },
    { id: "X", data_inicio: "2026-07-01", data_fim: "2026-07-05" },
  ];
  const deps = [
    { predecessor_item_id: "A", item_id: "B" },
    { predecessor_item_id: "B", item_id: "C" },
  ];
  it("desloca sucessoras transitivas e ignora não-relacionadas", () => {
    const r = calcularCascata(itens, deps, "A", 3);
    expect(r).toHaveLength(2);
    const b = r.find((x) => x.id === "B")!;
    expect(b).toEqual({ id: "B", data_inicio: "2026-06-09", data_fim: "2026-06-13" });
    const c = r.find((x) => x.id === "C")!;
    expect(c.data_inicio).toBe("2026-06-14");
    expect(r.find((x) => x.id === "X")).toBeUndefined();
    expect(r.find((x) => x.id === "A")).toBeUndefined();
  });
  it("devolve lista vazia quando delta é 0", () => {
    expect(calcularCascata(itens, deps, "A", 0)).toEqual([]);
  });
});
