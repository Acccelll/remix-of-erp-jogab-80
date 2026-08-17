import { describe, it, expect } from "vitest";
import {
  acumuladoMedido,
  saldoContrato,
  validarNovaMedicao,
  valorTotalContrato,
  percentualParaValor,
  MedicaoError,
} from "../medicao";

const contrato = { id: "C1", valor: 100000 };

describe("acumuladoMedido", () => {
  it("soma apenas aprovadas e faturadas", () => {
    expect(
      acumuladoMedido([
        {
          contrato_id: "C1",
          data_corte: "2026-06-01",
          percentual: 10,
          valor: 10000,
          status: "aprovada",
        },
        {
          contrato_id: "C1",
          data_corte: "2026-06-15",
          percentual: 20,
          valor: 20000,
          status: "faturada",
        },
        {
          contrato_id: "C1",
          data_corte: "2026-06-20",
          percentual: 30,
          valor: 30000,
          status: "rascunho",
        },
        {
          contrato_id: "C1",
          data_corte: "2026-06-25",
          percentual: 5,
          valor: 5000,
          status: "cancelada",
        },
      ]),
    ).toBe(30000);
  });
});

describe("valorTotalContrato + saldoContrato", () => {
  it("soma aditivos ativos/aprovados ao valor base", () => {
    const total = valorTotalContrato(contrato, [
      { contrato_id: "C1", valor: 5000, status: "aprovado" },
      { contrato_id: "C1", valor: 3000, status: "ativo" },
      { contrato_id: "C1", valor: 9999, status: "rascunho" }, // ignora
    ]);
    expect(total).toBe(108000);
  });

  it("saldo desconta acumulado medido", () => {
    expect(
      saldoContrato(
        contrato,
        [
          {
            contrato_id: "C1",
            data_corte: "2026-06-01",
            percentual: 10,
            valor: 10000,
            status: "aprovada",
          },
        ],
        [],
      ),
    ).toBe(90000);
  });
});

describe("validarNovaMedicao", () => {
  it("aceita medição dentro do saldo", () => {
    expect(() =>
      validarNovaMedicao(contrato, [], [], { valor: 50000, status: "aprovada" }),
    ).not.toThrow();
  });

  it("rejeita medição que ultrapassa total + aditivos", () => {
    expect(() =>
      validarNovaMedicao(
        contrato,
        [
          {
            contrato_id: "C1",
            data_corte: "2026-06-01",
            percentual: 90,
            valor: 90000,
            status: "aprovada",
          },
        ],
        [],
        { valor: 20000, status: "aprovada" },
      ),
    ).toThrow(MedicaoError);
  });

  it("ignora medição em rascunho (não conta no saldo)", () => {
    expect(() =>
      validarNovaMedicao(contrato, [], [], { valor: 999999, status: "rascunho" }),
    ).not.toThrow();
  });

  it("rejeita valor negativo", () => {
    expect(() => validarNovaMedicao(contrato, [], [], { valor: -1, status: "aprovada" })).toThrow();
  });
});

describe("percentualParaValor", () => {
  it("aplica percentual sobre o total com aditivos", () => {
    expect(percentualParaValor(contrato, [{ valor: 10000, status: "aprovado" }], 10)).toBe(11000);
  });
});
