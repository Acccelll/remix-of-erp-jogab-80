import { describe, it, expect } from "vitest";
import { ratearPorObra, ratearPorCompetencia } from "../rateio";

describe("rateio de antecipação", () => {
  const ops = [
    {
      id: "op1",
      dataOperacao: "2026-03-15",
      desagio: 1000,
      iof: 100,
      tarifas: 50,
      titulos: [
        { id: "t1", operacaoId: "op1", obraId: "A", valorFace: 6000 },
        { id: "t2", operacaoId: "op1", obraId: "B", valorFace: 4000 },
      ],
    },
    {
      id: "op2",
      dataOperacao: "2026-04-10",
      desagio: 500,
      iof: 0,
      tarifas: 0,
      titulos: [{ id: "t3", operacaoId: "op2", obraId: "A", valorFace: 5000 }],
    },
  ];

  it("rateia deságio/IOF/tarifas por obra proporcionalmente ao face", () => {
    const r = ratearPorObra(ops);
    const a = r.find((x) => x.obraId === "A")!;
    const b = r.find((x) => x.obraId === "B")!;
    // obra A: 60% de (1000+100+50) da op1 + 500 da op2 = 690 + 500 = 1190
    expect(a.custoTotal).toBeCloseTo(1190, 2);
    expect(a.operacoes).toBe(2);
    expect(a.titulos).toBe(2);
    expect(a.valorFace).toBeCloseTo(11000, 2);
    // obra B: 40% de 1150 = 460
    expect(b.custoTotal).toBeCloseTo(460, 2);
  });

  it("agrega por competência (YYYY-MM)", () => {
    const r = ratearPorCompetencia(ops);
    expect(r).toHaveLength(2);
    expect(r[0].competencia).toBe("2026-03");
    expect(r[0].custoTotal).toBeCloseTo(1150, 2);
    expect(r[1].competencia).toBe("2026-04");
    expect(r[1].custoTotal).toBeCloseTo(500, 2);
  });

  it("títulos sem obra_id caem em bucket __sem_obra__", () => {
    const r = ratearPorObra([
      {
        id: "op",
        dataOperacao: "2026-05-01",
        desagio: 100,
        iof: 0,
        tarifas: 0,
        titulos: [{ id: "t", operacaoId: "op", obraId: null, valorFace: 1000 }],
      },
    ]);
    expect(r[0].obraId).toBe("__sem_obra__");
    expect(r[0].custoTotal).toBeCloseTo(100, 2);
  });
});
