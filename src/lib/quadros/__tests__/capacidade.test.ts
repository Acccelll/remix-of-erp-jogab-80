import { describe, it, expect } from "vitest";
import { calcularCapacidade } from "../capacidade";

const obras = [
  { id: "o1", nome: "Obra A", ativa: true },
  { id: "o2", nome: "Obra B", ativa: true },
];

describe("calcularCapacidade (PRO-022.slice-01)", () => {
  it("agrega por obra e função, ordenando por quantidade", () => {
    const r = calcularCapacidade(
      [
        { id: "c1", ativo: true, obraAtualId: "o1", funcao: "Pedreiro" },
        { id: "c2", ativo: true, obraAtualId: "o1", funcao: "Pedreiro" },
        { id: "c3", ativo: true, obraAtualId: "o1", funcao: "Servente" },
        { id: "c4", ativo: true, obraAtualId: "o2", funcao: "Eletricista" },
      ],
      obras,
    );
    expect(r.totalAlocados).toBe(4);
    expect(r.porObra[0].obraId).toBe("o1");
    expect(r.porObra[0].total).toBe(3);
    expect(r.porObra[0].porFuncao[0]).toEqual({ funcao: "Pedreiro", qtd: 2 });
  });

  it("separa sem obra, especiais (__ferias__) e ignora inativos e obras inexistentes", () => {
    const r = calcularCapacidade(
      [
        { id: "c1", ativo: true, obraAtualId: null, funcao: "X" },
        { id: "c2", ativo: true, obraAtualId: "__ferias__", funcao: "X" },
        { id: "c3", ativo: false, obraAtualId: "o1", funcao: "X" },
        { id: "c4", ativo: true, obraAtualId: "o-fantasma", funcao: "X" },
      ],
      obras,
    );
    expect(r.totalDisponiveis).toBe(3);
    expect(r.totalSemObra).toBe(1);
    expect(r.totalEspeciais).toBe(1);
    expect(r.totalAlocados).toBe(0);
    expect(r.porObra).toEqual([]);
  });

  it("usa 'Sem função' quando função vazia", () => {
    const r = calcularCapacidade(
      [{ id: "c1", ativo: true, obraAtualId: "o1", funcao: "" }],
      obras,
    );
    expect(r.porObra[0].porFuncao[0].funcao).toBe("Sem função");
  });

  it("combina demanda planejada por obra/função e destaca déficit", () => {
    const r = calcularCapacidade(
      [
        { id: "c1", ativo: true, obraAtualId: "o1", funcao: "Pedreiro" },
        { id: "c2", ativo: true, obraAtualId: "o1", funcao: "Servente" },
      ],
      obras,
      [
        { obraId: "o1", funcao: "Pedreiro", quantidade: 3 },
        { obraId: "o1", funcao: "Servente", quantidade: 1 },
        { obraId: "o2", funcao: "Eletricista", quantidade: 4 },
      ],
    );

    expect(r.porObra[0].obraId).toBe("o2");
    expect(r.porObra[0].demandaTotal).toBe(4);
    expect(r.porObra[0].deficitTotal).toBe(4);
    expect(r.porObra[1].porFuncaoDemanda).toContainEqual({
      funcao: "Pedreiro",
      alocado: 1,
      demanda: 3,
      saldo: -2,
    });
  });
});
