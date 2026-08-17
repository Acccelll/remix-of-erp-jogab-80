import { describe, it, expect } from "vitest";
import { calcularCustoComprometido } from "../committed-cost";

describe("calcularCustoComprometido", () => {
  it("retorna zero para lista vazia", () => {
    const r = calcularCustoComprometido([]);
    expect(r.total).toBe(0);
    expect(r.qtdCards).toBe(0);
    expect(r.porTipo).toEqual({});
  });

  it("usa valor_oc quando presente, ignorando estimado", () => {
    const r = calcularCustoComprometido([
      { tipo_recurso: "material_pronto", valor_estimado: 100, valor_oc: 120 },
    ]);
    expect(r.total).toBe(120);
    expect(r.totalComOc).toBe(120);
    expect(r.totalEstimado).toBe(0);
    expect(r.qtdComOc).toBe(1);
  });

  it("cai para valor_estimado quando não há OC", () => {
    const r = calcularCustoComprometido([
      { tipo_recurso: "servico", valor_estimado: 500, valor_oc: null },
    ]);
    expect(r.total).toBe(500);
    expect(r.totalEstimado).toBe(500);
    expect(r.totalComOc).toBe(0);
  });

  it("ignora cards sem nenhum valor", () => {
    const r = calcularCustoComprometido([
      { tipo_recurso: "equipamento", valor_estimado: null, valor_oc: null },
      { tipo_recurso: "equipamento", valor_estimado: 0, valor_oc: 0 },
    ]);
    expect(r.qtdCards).toBe(0);
    expect(r.total).toBe(0);
  });

  it("agrega por tipo de recurso", () => {
    const r = calcularCustoComprometido([
      { tipo_recurso: "material_pronto", valor_estimado: null, valor_oc: 1000 },
      { tipo_recurso: "material_pronto", valor_estimado: 200, valor_oc: null },
      { tipo_recurso: "manufaturado", valor_estimado: null, valor_oc: 5000 },
      { tipo_recurso: "servico", valor_estimado: 800, valor_oc: null },
    ]);
    expect(r.total).toBe(7000);
    expect(r.totalComOc).toBe(6000);
    expect(r.totalEstimado).toBe(1000);
    expect(r.qtdCards).toBe(4);
    expect(r.qtdComOc).toBe(2);
    expect(r.porTipo).toEqual({
      material_pronto: 1200,
      manufaturado: 5000,
      servico: 800,
    });
  });
});
