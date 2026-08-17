import { describe, it, expect } from "vitest";
import { custoEquipamentoObra, alertasPreventiva } from "../custo-equipamento";

const periodo = { inicio: "2026-06-01", fim: "2026-06-30" };

describe("custoEquipamentoObra", () => {
  it("soma combustível e manutenção dentro do período da obra", () => {
    const r = custoEquipamentoObra(
      [
        { veiculo_id: "V1", obra_id: "O1", data: "2026-06-10", valor: 500 },
        { veiculo_id: "V1", obra_id: "O1", data: "2026-05-30", valor: 999 }, // fora
        { veiculo_id: "V1", obra_id: "O2", data: "2026-06-12", valor: 999 }, // outra obra
      ],
      [{ veiculo_id: "V1", obra_id: "O1", data: "2026-06-15", valor: 200, tipo: "corretiva" }],
      [],
      { obra_id: "O1", periodo },
    );
    expect(r.combustivel).toBe(500);
    expect(r.manutencao).toBe(200);
    expect(r.periodo).toBe(0);
    expect(r.total).toBe(700);
    expect(r.porAtivo["v:V1"]).toEqual({
      combustivel: 500,
      manutencao: 200,
      periodo: 0,
      total: 700,
    });
  });

  it("rateia apropriação por dias quando janela cruza o período", () => {
    // janela 2026-05-20 → 2026-06-19 (31 dias), custo 3100
    // overlap com período = 2026-06-01 → 2026-06-19 = 19 dias
    // valor = 3100 * 19/31 = 1900
    const r = custoEquipamentoObra(
      [],
      [],
      [
        {
          patrimonio_id: "P1",
          obra_id: "O1",
          data_inicio: "2026-05-20",
          data_fim: "2026-06-19",
          custo_periodo: 3100,
        },
      ],
      { obra_id: "O1", periodo },
    );
    expect(r.periodo).toBeCloseTo(1900, 2);
    expect(r.porAtivo["p:P1"].total).toBeCloseTo(1900, 2);
  });

  it("apropriação aberta usa fim do período", () => {
    const r = custoEquipamentoObra(
      [],
      [],
      [
        {
          veiculo_id: "V1",
          obra_id: "O1",
          data_inicio: "2026-06-01",
          data_fim: null,
          custo_periodo: 3000,
        },
      ],
      { obra_id: "O1", periodo },
    );
    expect(r.periodo).toBeCloseTo(3000, 2);
  });

  it("ativo trocando de obra no meio do mês rateia para cada obra", () => {
    // ativo na O1 do dia 1 ao 15 (15d, custo 1500), depois O2 do 16 ao 30 (15d, 1500)
    const apropriacoes = [
      {
        veiculo_id: "V1",
        obra_id: "O1",
        data_inicio: "2026-06-01",
        data_fim: "2026-06-15",
        custo_periodo: 1500,
      },
      {
        veiculo_id: "V1",
        obra_id: "O2",
        data_inicio: "2026-06-16",
        data_fim: "2026-06-30",
        custo_periodo: 1500,
      },
    ];
    const r1 = custoEquipamentoObra([], [], apropriacoes, { obra_id: "O1", periodo });
    const r2 = custoEquipamentoObra([], [], apropriacoes, { obra_id: "O2", periodo });
    expect(r1.periodo).toBeCloseTo(1500, 2);
    expect(r2.periodo).toBeCloseTo(1500, 2);
  });

  it("ignora apropriação fora do período", () => {
    const r = custoEquipamentoObra(
      [],
      [],
      [
        {
          veiculo_id: "V1",
          obra_id: "O1",
          data_inicio: "2026-04-01",
          data_fim: "2026-04-30",
          custo_periodo: 999,
        },
      ],
      { obra_id: "O1", periodo },
    );
    expect(r.periodo).toBe(0);
  });
});

describe("alertasPreventiva", () => {
  it("retorna ativos próximos da próxima preventiva", () => {
    const alertas = alertasPreventiva(
      [
        {
          veiculo_id: "V1",
          data: "2026-05-01",
          valor: 0,
          tipo: "preventiva",
          proxima_preventiva_horimetro: 1000,
        },
      ],
      { "v:V1": 970 },
      50,
    );
    expect(alertas).toHaveLength(1);
    expect(alertas[0].faltam).toBe(30);
  });

  it("ignora quando ainda está longe", () => {
    const alertas = alertasPreventiva(
      [
        {
          veiculo_id: "V1",
          data: "2026-05-01",
          valor: 0,
          tipo: "preventiva",
          proxima_preventiva_horimetro: 1000,
        },
      ],
      { "v:V1": 500 },
      50,
    );
    expect(alertas).toHaveLength(0);
  });
});
