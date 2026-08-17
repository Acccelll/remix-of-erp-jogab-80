/**
 * TEST.2 — Cadeias de valor (puro, sem banco).
 *
 * Prova que os números compõem corretamente entre as libs de orçamento,
 * suprimentos, recursos, contratos e EVM. Sem mock de Supabase.
 *
 * Pega bugs de integração de lógica (um módulo muda a forma do número e o
 * outro não acompanha) sem precisar subir banco.
 */
import { describe, it, expect } from "vitest";
import {
  custoUnitarioComposicao,
  valorItemOrcamento,
  custoAtividade,
} from "@/lib/orcamento/orcamento";
import { calcularBAC, calcularEVM, type EvmItemCrono } from "@/lib/pmbok/evm";
import { calcularCustoComprometido } from "@/lib/recursos/committed-cost";
import { saldoOrcado } from "@/lib/suprimentos/saldo-orcado";
import {
  acumuladoMedido,
  valorTotalContrato,
  saldoContrato,
  validarNovaMedicao,
  MedicaoError,
  type MedicaoContrato,
} from "@/lib/contratos/medicao";

function evmItem(o: Partial<EvmItemCrono>): EvmItemCrono {
  return {
    custo: 0,
    custo_baseline: null,
    percentual_previsto: 0,
    percentual_realizado: 0,
    data_inicio: "2025-01-01",
    data_fim: "2025-12-31",
    data_inicio_baseline: null,
    data_fim_baseline: null,
    ativo: true,
    ...o,
  };
}

describe("Cadeia 1 — Orçamento → custo → EVM (BAC)", () => {
  it("BAC do cronograma = soma dos valor_total dos itens orçados", () => {
    // Composição A: 2 insumos
    const composA = [
      { coeficiente: 2, preco_unitario: 10 }, // 20
      { coeficiente: 1.5, preco_unitario: 4 }, // 6
    ];
    const cuA = custoUnitarioComposicao(composA); // 26
    expect(cuA).toBe(26);

    // Composição B
    const composB = [
      { coeficiente: 3, preco_unitario: 5 }, // 15
    ];
    const cuB = custoUnitarioComposicao(composB); // 15

    // 2 itens orçamentários: qtdA=100 → 2600, qtdB=50 → 750
    const valItemA = valorItemOrcamento(100, cuA); // 2600
    const valItemB = valorItemOrcamento(50, cuB); // 750
    expect(valItemA).toBe(2600);
    expect(valItemB).toBe(750);

    // Custo de uma atividade que agrupa esses itens
    const custoAtv1 = custoAtividade([{ valor_total: valItemA }, { valor_total: valItemB }]);
    expect(custoAtv1).toBe(3350);

    // Outra atividade só com composição A em qtd menor
    const custoAtv2 = custoAtividade([{ valor_total: valorItemOrcamento(10, cuA) }]); // 260

    // Estes custos viram cronograma_itens.custo (write-back). Alimentamos o EVM.
    const itens = [
      evmItem({ custo: custoAtv1, percentual_realizado: 40 }),
      evmItem({ custo: custoAtv2, percentual_realizado: 0 }),
    ];

    const bac = calcularBAC(itens);
    expect(bac).toBe(custoAtv1 + custoAtv2); // 3610

    const r = calcularEVM({ itens, dataRef: new Date("2025-06-01") });
    expect(r.BAC).toBe(3610);
    // EV = 3350*0.4 + 260*0 = 1340
    expect(r.EV).toBe(1340);
  });
});

describe("Cadeia 2 — Requisição → OC → committed cost", () => {
  it("valor_oc prevalece sobre estimado; estimado só conta sem OC", () => {
    const cards = [
      // só estimado
      { tipo_recurso: "material_pronto", valor_estimado: 200, valor_oc: null },
      // OC emitida (valor_estimado ignorado)
      { tipo_recurso: "material_pronto", valor_estimado: 999, valor_oc: 1500 },
      // OC emitida em outro tipo
      { tipo_recurso: "servico", valor_estimado: null, valor_oc: 800 },
    ];
    const r = calcularCustoComprometido(cards);
    expect(r.total).toBe(200 + 1500 + 800);
    expect(r.totalComOc).toBe(1500 + 800);
    expect(r.totalEstimado).toBe(200);
    expect(r.qtdCards).toBe(3);
    expect(r.qtdComOc).toBe(2);
    expect(r.porTipo).toEqual({
      material_pronto: 1700,
      servico: 800,
    });
  });
});

describe("Cadeia 3 — Requisição vs orçado (fronteiras)", () => {
  it("requisitado = orçado: saldo zero, não excedido", () => {
    const r = saldoOrcado({ quantidade: 100 }, [{ quantidade: 100 }]);
    expect(r.saldo).toBe(0);
    expect(r.excedido).toBe(false);
    expect(r.excesso).toBe(0);
  });

  it("requisitado > orçado por 1 unidade: excedido", () => {
    const r = saldoOrcado({ quantidade: 100 }, [
      { quantidade: 50 },
      { quantidade: 51, status: "cotando" },
    ]);
    expect(r.requisitado).toBe(101);
    expect(r.excedido).toBe(true);
    expect(r.excesso).toBe(1);
  });

  it("cancelada não conta contra o saldo", () => {
    const r = saldoOrcado({ quantidade: 100 }, [
      { quantidade: 80 },
      { quantidade: 500, status: "cancelada" },
    ]);
    expect(r.requisitado).toBe(80);
    expect(r.excedido).toBe(false);
  });
});

describe("Cadeia 4 — Medição → faturamento", () => {
  const contrato = { id: "c1", valor: 1000 };
  const aditivos = [
    { contrato_id: "c1", valor: 200, status: "aprovado" },
    { contrato_id: "c1", valor: 999, status: "rascunho" }, // não conta
  ];

  it("só medições aprovadas/faturadas entram no acumulado", () => {
    const medicoes: MedicaoContrato[] = [
      {
        contrato_id: "c1",
        data_corte: "2025-03-31",
        percentual: 30,
        valor: 300,
        status: "aprovada",
      },
      {
        contrato_id: "c1",
        data_corte: "2025-04-30",
        percentual: 20,
        valor: 200,
        status: "faturada",
      },
      {
        contrato_id: "c1",
        data_corte: "2025-05-31",
        percentual: 10,
        valor: 999,
        status: "rascunho",
      },
      {
        contrato_id: "c1",
        data_corte: "2025-05-31",
        percentual: 10,
        valor: 888,
        status: "cancelada",
      },
    ];
    expect(acumuladoMedido(medicoes)).toBe(500);
    expect(valorTotalContrato(contrato, aditivos)).toBe(1200);
    expect(saldoContrato(contrato, medicoes, aditivos)).toBe(700);
  });

  it("nova medição que estoura o saldo é rejeitada", () => {
    const medicoes: MedicaoContrato[] = [
      {
        contrato_id: "c1",
        data_corte: "2025-03-31",
        percentual: 90,
        valor: 1100,
        status: "aprovada",
      },
    ];
    expect(() =>
      validarNovaMedicao(contrato, medicoes, aditivos, { valor: 200, status: "aprovada" }),
    ).toThrow(MedicaoError);
  });

  it("nova medição em rascunho não valida saldo (não contabiliza)", () => {
    const medicoes: MedicaoContrato[] = [
      {
        contrato_id: "c1",
        data_corte: "2025-03-31",
        percentual: 100,
        valor: 1200,
        status: "aprovada",
      },
    ];
    // Em rascunho passa mesmo com saldo esgotado.
    expect(() =>
      validarNovaMedicao(contrato, medicoes, aditivos, { valor: 500, status: "rascunho" }),
    ).not.toThrow();
  });
});
