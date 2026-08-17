import { describe, it, expect } from "vitest";
import {
  redistribuirSaldo,
  redistribuirDeltaBmsFuturas,
  calcularVencimento,
  statusRecebimento,
  type ParcelaPrevisao,
} from "@/lib/billing";

describe("redistribuirSaldo", () => {
  it("redistribui proporcionalmente entre parcelas restantes", () => {
    const parcelas: ParcelaPrevisao[] = [
      { data_medicao: new Date(), valor_previsto: 100, valor_realizado: 120 },
      { data_medicao: new Date(), valor_previsto: 100 },
      { data_medicao: new Date(), valor_previsto: 100 },
    ];
    const r = redistribuirSaldo(300, parcelas);
    // consumido = 120; saldo = 180; restantes têm peso igual → 90 cada
    expect(r[0].valor_previsto).toBe(100);
    expect(r[1].valor_previsto).toBeCloseTo(90);
    expect(r[2].valor_previsto).toBeCloseTo(90);
  });

  it("respeita parcelas congeladas", () => {
    const parcelas: ParcelaPrevisao[] = [
      { data_medicao: new Date(), valor_previsto: 50, congelada: true },
      { data_medicao: new Date(), valor_previsto: 100 },
    ];
    const r = redistribuirSaldo(200, parcelas);
    expect(r[0].valor_previsto).toBe(50);
    expect(r[1].valor_previsto).toBeCloseTo(150);
  });

  it("distribui zero quando saldo é negativo (clamp)", () => {
    const parcelas: ParcelaPrevisao[] = [
      { data_medicao: new Date(), valor_previsto: 100, valor_realizado: 500 },
      { data_medicao: new Date(), valor_previsto: 100 },
    ];
    const r = redistribuirSaldo(200, parcelas);
    expect(r[1].valor_previsto).toBe(0);
  });
});

describe("redistribuirDeltaBmsFuturas", () => {
  const bms = [
    { id: "a", numero: 1, valor_previsto_dinamico: 100, status: "faturada" },
    { id: "b", numero: 2, valor_previsto_dinamico: 100, status: "prevista" },
    { id: "c", numero: 3, valor_previsto_dinamico: 300, status: "prevista" },
  ];

  it("delta positivo (faturou menos) aumenta futuras proporcionalmente", () => {
    const { delta, futuras } = redistribuirDeltaBmsFuturas({
      numeroAtual: 1,
      valorPrevistoBmsAtual: 100,
      valorFaturado: 80,
      todasBms: bms,
    });
    expect(delta).toBe(20);
    expect(futuras).toHaveLength(2);
    // pesos: 100/400 e 300/400 → +5 e +15
    expect(futuras[0].valor_novo).toBeCloseTo(105);
    expect(futuras[1].valor_novo).toBeCloseTo(315);
  });

  it("delta zero não altera futuras", () => {
    const r = redistribuirDeltaBmsFuturas({
      numeroAtual: 1,
      valorPrevistoBmsAtual: 100,
      valorFaturado: 100,
      todasBms: bms,
    });
    expect(r.delta).toBe(0);
    expect(r.futuras[0].valor_novo).toBe(r.futuras[0].valor_anterior);
  });

  it("futuras zeradas → divisão igualitária", () => {
    const zeradas = [
      { id: "b", numero: 2, valor_previsto_dinamico: 0, status: "prevista" },
      { id: "c", numero: 3, valor_previsto_dinamico: 0, status: "prevista" },
    ];
    const { futuras } = redistribuirDeltaBmsFuturas({
      numeroAtual: 1,
      valorPrevistoBmsAtual: 100,
      valorFaturado: 60,
      todasBms: zeradas,
    });
    expect(futuras[0].valor_novo).toBeCloseTo(20);
    expect(futuras[1].valor_novo).toBeCloseTo(20);
  });
});

describe("calcularVencimento", () => {
  it("aplica DDL + dia fixo do mês", () => {
    // emissão 03/05/2025, +30d = 02/06; dia fixo 15 → 15/06
    const r = calcularVencimento(new Date(2025, 4, 3), 30, 15);
    expect(r.getMonth()).toBe(5);
    expect(r.getDate()).toBe(15);
  });

  it("sem dia fixo retorna base", () => {
    const r = calcularVencimento(new Date(2025, 0, 1), 10);
    expect(r.getDate()).toBe(11);
  });

  it("escolhe o dia fixo mais próximo entre múltiplos", () => {
    const r = calcularVencimento(new Date(2025, 4, 3), 30, [5, 20]);
    // base 02/06 → próximo entre 05 e 20 do mês → 05/06
    expect(r.getDate()).toBe(5);
  });
});

describe("statusRecebimento", () => {
  it("recebido → pago", () => {
    expect(statusRecebimento(new Date(2025, 0, 1), new Date())).toBe("pago");
  });
  it("vencido sem recebimento → atrasado", () => {
    expect(statusRecebimento(new Date(2000, 0, 1))).toBe("atrasado");
  });
  it("futuro → a_receber", () => {
    expect(statusRecebimento(new Date(Date.now() + 86400000))).toBe("a_receber");
  });
});
