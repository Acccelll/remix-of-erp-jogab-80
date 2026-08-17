import { describe, expect, it } from "vitest";
import {
  custoPorDia,
  custoPorObra,
  diasOcioso,
  periodosEmObra,
} from "@/lib/contratos/custoPorPeriodo";
import type { PeriodoContrato } from "@/types";

const p = (over: Partial<PeriodoContrato> = {}): PeriodoContrato => ({
  id: "p1",
  contrato_id: "k1",
  tipo: "obra",
  obra_id: "o1",
  obra_nome: "Obra 1",
  status: null,
  data_inicio: "2025-01-01",
  data_fim: null,
  dias: 10,
  ...over,
});

describe("custoPorDia", () => {
  it("divide o valor pela vigência", () => {
    expect(custoPorDia(3000, 30)).toBe(100);
  });

  it("devolve 0 quando não há vigência, em vez de Infinity", () => {
    // Contrato sem início/término não tem custo diário definido. Devolver
    // Infinity contaminaria toda a soma seguinte com NaN.
    expect(custoPorDia(3000, 0)).toBe(0);
    expect(custoPorDia(3000, -5)).toBe(0);
  });

  it("tolera entrada não numérica", () => {
    expect(custoPorDia(Number.NaN, 30)).toBe(0);
    expect(custoPorDia(3000, Number.NaN)).toBe(0);
  });
});

describe("custoPorObra", () => {
  it("distribui proporcional aos dias em cada obra", () => {
    const r = custoPorObra(
      [p({ id: "a", obra_id: "o1", obra_nome: "Obra 1", dias: 20 }),
       p({ id: "b", obra_id: "o2", obra_nome: "Obra 2", dias: 10 })],
      3000,
      30,
    );
    expect(r).toEqual([
      { obraId: "o1", obraNome: "Obra 1", dias: 20, custo: 2000 },
      { obraId: "o2", obraNome: "Obra 2", dias: 10, custo: 1000 },
    ]);
  });

  it("período ocioso não recebe custo de obra", () => {
    // O contrato não estava a serviço de obra nenhuma nesse intervalo;
    // atribuir o custo a uma delas seria inventar rateio.
    const r = custoPorObra(
      [p({ id: "a", dias: 20 }),
       p({ id: "b", tipo: "status", obra_id: null, obra_nome: null, status: "ocioso", dias: 10 })],
      3000,
      30,
    );
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ obraId: "o1", dias: 20, custo: 2000 });
  });

  it("soma períodos repetidos da mesma obra", () => {
    const r = custoPorObra(
      [p({ id: "a", dias: 5 }), p({ id: "b", dias: 15 })],
      2000,
      20,
    );
    expect(r).toEqual([{ obraId: "o1", obraNome: "Obra 1", dias: 20, custo: 2000 }]);
  });

  it("ignora períodos substituídos", () => {
    const r = custoPorObra(
      [p({ id: "a", dias: 20 }), p({ id: "dup", dias: 0, substituido: true })],
      3000,
      30,
    );
    expect(r).toHaveLength(1);
    expect(r[0].dias).toBe(20);
  });

  it("devolve lista vazia sem períodos de obra", () => {
    expect(custoPorObra([], 3000, 30)).toEqual([]);
    expect(
      custoPorObra([p({ tipo: "status", obra_id: null, status: "ocioso" })], 3000, 30),
    ).toEqual([]);
  });
});

describe("diasOcioso e periodosEmObra", () => {
  it("separa as duas grandezas", () => {
    const lista = [
      p({ id: "a", dias: 20 }),
      p({ id: "b", tipo: "status", obra_id: null, status: "ocioso", dias: 12 }),
    ];
    expect(periodosEmObra(lista)).toHaveLength(1);
    expect(diasOcioso(lista)).toBe(12);
  });
});
