import { describe, it, expect } from "vitest";
import { gerarBmsPrevistasParaObra } from "@/lib/bms/previstas";

describe("gerarBmsPrevistasParaObra", () => {
  it("conserva Σ linhas = valorContrato (Bug 5: caso normal)", () => {
    const { linhas, avisos } = gerarBmsPrevistasParaObra({
      obraId: "o1",
      dataInicio: new Date(2025, 0, 1),
      dataFim: new Date(2025, 2, 31),
      valorContrato: 100000,
      valorAntecipacao: 10000,
      diasCorteBms: [15, 30],
      diasAteEmissaoNf: 5,
      prazoPagamentoDias: 30,
      diasFixosPagamento: [],
      itens: [
        {
          itemId: "i1",
          dataInicio: new Date(2025, 0, 1),
          dataFim: new Date(2025, 1, 28),
          valorTotal: 60000,
        },
        {
          itemId: "i2",
          dataInicio: new Date(2025, 1, 1),
          dataFim: new Date(2025, 2, 31),
          valorTotal: 30000,
        },
      ],
    });
    const soma = linhas.reduce((a, b) => a + Number(b.valor_previsto_inicial), 0);
    expect(soma).toBeCloseTo(100000, 1);
    expect(avisos).toHaveLength(0);
  });

  it("Bug 5: todos os itens são marcos → divide igual e emite aviso", () => {
    const { linhas, avisos } = gerarBmsPrevistasParaObra({
      obraId: "o1",
      dataInicio: new Date(2025, 0, 1),
      dataFim: new Date(2025, 2, 31),
      valorContrato: 60000,
      valorAntecipacao: 0,
      diasCorteBms: [30],
      diasAteEmissaoNf: 5,
      prazoPagamentoDias: 30,
      diasFixosPagamento: [],
      itens: [
        // Marcos: data_inicio == data_fim → contribuição zero
        {
          itemId: "m1",
          dataInicio: new Date(2025, 0, 15),
          dataFim: new Date(2025, 0, 15),
          valorTotal: 0,
        },
      ],
    });
    expect(avisos.length).toBeGreaterThan(0);
    const soma = linhas.reduce((a, b) => a + Number(b.valor_previsto_inicial), 0);
    expect(soma).toBeCloseTo(60000, 1);
    // todas as janelas com valor positivo
    expect(linhas.every((l) => Number(l.valor_previsto_inicial) > 0)).toBe(true);
  });
});
