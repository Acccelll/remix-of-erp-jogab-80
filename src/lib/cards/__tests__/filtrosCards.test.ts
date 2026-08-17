import { describe, it, expect } from "vitest";
import {
  encodeFiltros,
  decodeFiltros,
  temFiltrosAtivos,
  aplicaFiltros,
  type CardFiltravel,
} from "../filtrosCards";

const HOJE = new Date("2026-06-30T12:00:00");

function mk(o: Partial<CardFiltravel>): CardFiltravel {
  return {
    responsavelId: o.responsavelId ?? null,
    setores: o.setores ?? [],
    labelIds: o.labelIds ?? [],
    prazo: o.prazo ?? null,
    checklistTotal: o.checklistTotal,
    checklistConcluido: o.checklistConcluido,
  };
}

describe("filtrosCards", () => {
  it("encode/decode round-trip", () => {
    const f = { etiquetaId: "L1", prazo: "vencido" as const, semResponsavel: true };
    const s = encodeFiltros(f);
    expect(s).not.toEqual("");
    expect(decodeFiltros(s)).toEqual(f);
  });

  it("encodeFiltros vazio retorna string vazia", () => {
    expect(encodeFiltros({})).toBe("");
    expect(decodeFiltros("")).toEqual({});
    expect(decodeFiltros(null)).toEqual({});
    expect(decodeFiltros("lixo!!!")).toEqual({});
  });

  it("temFiltrosAtivos detecta presença", () => {
    expect(temFiltrosAtivos({})).toBe(false);
    expect(temFiltrosAtivos({ etiquetaId: "L1" })).toBe(true);
    expect(temFiltrosAtivos({ semResponsavel: true })).toBe(true);
  });

  it("aplica filtros: etiqueta, setor, responsável, sem-responsável", () => {
    const cards = [
      mk({ responsavelId: "u1", setores: ["Compras"], labelIds: ["L1"] }),
      mk({ responsavelId: "u2", setores: ["Obra"], labelIds: ["L2"] }),
      mk({ responsavelId: null, setores: ["Obra"], labelIds: ["L1"] }),
    ];
    expect(aplicaFiltros(cards, { etiquetaId: "L1" }, HOJE)).toHaveLength(2);
    expect(aplicaFiltros(cards, { setor: "Obra" }, HOJE)).toHaveLength(2);
    expect(aplicaFiltros(cards, { responsavelId: "u1" }, HOJE)).toHaveLength(1);
    expect(aplicaFiltros(cards, { semResponsavel: true }, HOJE)).toHaveLength(1);
  });

  it("aplica filtros de prazo: vencido/hoje/semana/sem-prazo", () => {
    const cards = [
      mk({ prazo: "2026-06-29" }), // vencido
      mk({ prazo: "2026-06-30" }), // hoje
      mk({ prazo: "2026-07-03" }), // semana
      mk({ prazo: null }), // sem prazo
      mk({ prazo: "2026-12-31" }), // fora dos buckets
    ];
    expect(aplicaFiltros(cards, { prazo: "vencido" }, HOJE)).toHaveLength(1);
    expect(aplicaFiltros(cards, { prazo: "hoje" }, HOJE)).toHaveLength(1);
    expect(aplicaFiltros(cards, { prazo: "semana" }, HOJE)).toHaveLength(1);
    expect(aplicaFiltros(cards, { prazo: "sem-prazo" }, HOJE)).toHaveLength(1);
  });

  it("checklist incompleto exige total>0 e ok<total", () => {
    const cards = [
      mk({ checklistTotal: 3, checklistConcluido: 1 }), // incompleto
      mk({ checklistTotal: 2, checklistConcluido: 2 }), // completo
      mk({ checklistTotal: 0, checklistConcluido: 0 }), // sem checklist
    ];
    expect(aplicaFiltros(cards, { checklistIncompleto: true }, HOJE)).toHaveLength(1);
  });

  it("filtros combinados (AND)", () => {
    const cards = [
      mk({ responsavelId: "u1", setores: ["Compras"], labelIds: ["L1"] }),
      mk({ responsavelId: "u1", setores: ["Obra"], labelIds: ["L1"] }),
    ];
    expect(aplicaFiltros(cards, { responsavelId: "u1", setor: "Obra" }, HOJE)).toHaveLength(1);
  });
});
