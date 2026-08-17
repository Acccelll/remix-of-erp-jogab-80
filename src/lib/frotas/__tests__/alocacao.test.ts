import { describe, it, expect } from "vitest";
import { motoristasElegiveis, veiculoNaColuna } from "../alocacao";

const veic = (over: Partial<Parameters<typeof veiculoNaColuna>[0]> = {}) => ({
  ativo: true,
  motoristaId: null as string | null,
  obraAtualId: null as string | null,
  ...over,
});

describe("veiculoNaColuna", () => {
  const colColabIds = new Set(["colab-1", "colab-2"]);

  it("ignora veículo inativo mesmo com motorista na coluna", () => {
    expect(
      veiculoNaColuna(veic({ ativo: false, motoristaId: "colab-1" }), colColabIds, "obra-1"),
    ).toBe(false);
  });

  it("conta veículo com motorista pela coluna do motorista", () => {
    expect(veiculoNaColuna(veic({ motoristaId: "colab-1" }), colColabIds, "obra-1")).toBe(true);
    expect(veiculoNaColuna(veic({ motoristaId: "colab-9" }), colColabIds, "obra-1")).toBe(false);
  });

  it("ignora a obra do próprio veículo quando ele tem motorista", () => {
    // Motorista fora da coluna manda, mesmo que o veículo aponte para ela.
    expect(
      veiculoNaColuna(
        veic({ motoristaId: "colab-9", obraAtualId: "obra-1" }),
        colColabIds,
        "obra-1",
      ),
    ).toBe(false);
  });

  it("conta veículo sem motorista pela obra dele próprio", () => {
    expect(veiculoNaColuna(veic({ obraAtualId: "obra-1" }), colColabIds, "obra-1")).toBe(true);
    expect(veiculoNaColuna(veic({ obraAtualId: "obra-2" }), colColabIds, "obra-1")).toBe(false);
  });

  it("não conta veículo sem motorista e sem obra", () => {
    expect(veiculoNaColuna(veic(), colColabIds, "obra-1")).toBe(false);
  });
});

describe("motoristasElegiveis", () => {
  const lista = [
    { id: "a", ativo: true, responsabilidades: ["quadroVeiculos"] },
    { id: "b", ativo: true, responsabilidades: ["quadroPatrimonios"] },
    { id: "c", ativo: false, responsabilidades: ["quadroVeiculos"] },
    { id: "d", ativo: true, responsabilidades: undefined },
  ];

  it("mantém apenas ativos com a responsabilidade de veículos", () => {
    expect(motoristasElegiveis(lista).map((c) => c.id)).toEqual(["a"]);
  });
});
