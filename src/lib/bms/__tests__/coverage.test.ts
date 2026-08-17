import { describe, expect, it } from "vitest";
import { bmsCoverage } from "../coverage";
import type { BmsWorkbook } from "../excel";

const colunasCompletas = {
  item: 0, desc: 1, qtd: 2, um: 3, preco: 4, total: 5,
  qa: 6, va: 7, qm: 8, vm: 9, qac: 10, vac: 11, sq: 12, sv: 13,
};

function wbFake(): BmsWorkbook {
  return {
    arquivoNome: "x.xlsx",
    sheets: [
      {
        sheetName: "BMS 01", numero: "BMS 01", ordem: 1, total_medicao: 1000,
        itens: [{ item: "1", descricao: "a" } as any, { item: "2", descricao: "b" } as any],
        diagnostico: {
          headerRow: 7, rotulosCabecalho: [], rotulosSubcabecalho: [],
          colunas: colunasCompletas,
        },
      },
      {
        sheetName: "BMS 02", numero: "BMS 02", ordem: 2, total_medicao: 500,
        itens: [{ item: "1" } as any],
        diagnostico: {
          headerRow: 7, rotulosCabecalho: [], rotulosSubcabecalho: [],
          colunas: { item: 0, desc: 1, qtd: 2, um: 3, preco: 4, total: 5, qa: 6 },
        },
      },
    ],
    ignoradas: [{ sheetName: "Capa", motivo: "sem cabeçalho" }],
  };
}

describe("bmsCoverage", () => {
  it("computa cobertura, totais e ignoradas", () => {
    const r = bmsCoverage(wbFake());
    expect(r.abasReconhecidas).toBe(2);
    expect(r.abasIgnoradas).toBe(1);
    expect(r.itensTotais).toBe(3);
    expect(r.valorTotalMes).toBe(1500);
    expect(r.porAba[0].coverage).toBe(1);
    expect(r.porAba[1].colunasMapeadas).toBe(7);
    expect(r.coverageMedio).toBeCloseTo((1 + 7 / 14) / 2, 5);
  });
});
