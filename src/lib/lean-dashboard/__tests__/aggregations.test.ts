import { describe, it, expect } from "vitest";
import {
  consolidarPpcPorObra,
  consolidarRestricoesPorCategoria,
  semaforoLookahead,
  topCausasGlobal,
  topRiscosCriticos,
} from "../aggregations";

describe("consolidarPpcPorObra", () => {
  it("calcula PPC por obra e ordena desc", () => {
    const r = consolidarPpcPorObra([
      { id: "1", obra_id: "A", concluido: true, causa_chave: null, semana_inicio: "" },
      { id: "2", obra_id: "A", concluido: false, causa_chave: "x", semana_inicio: "" },
      { id: "3", obra_id: "B", concluido: true, causa_chave: null, semana_inicio: "" },
      { id: "4", obra_id: "B", concluido: true, causa_chave: null, semana_inicio: "" },
    ]);
    expect(r[0]).toEqual({ obra_id: "B", total: 2, concluidos: 2, ppc: 1 });
    expect(r[1]).toEqual({ obra_id: "A", total: 2, concluidos: 1, ppc: 0.5 });
  });
});

describe("consolidarRestricoesPorCategoria", () => {
  it("agrupa abertas por tipo", () => {
    const r = consolidarRestricoesPorCategoria([
      { id: "1", obra_id: "A", tipo: "material", status: "aberta", prazo: null },
      { id: "2", obra_id: "A", tipo: "material", status: "resolvida", prazo: null },
      { id: "3", obra_id: "B", tipo: "projeto", status: "aberta", prazo: null },
    ]);
    expect(r).toEqual([
      { categoria: "material", abertas: 1, total: 2 },
      { categoria: "projeto", abertas: 1, total: 1 },
    ]);
  });
});

describe("semaforoLookahead", () => {
  const hoje = "2026-06-25";
  it("classifica pacotes", () => {
    const r = semaforoLookahead(
      [
        { id: "p1", obra_id: "A" },
        { id: "p2", obra_id: "A" },
        { id: "p3", obra_id: "A" },
      ],
      [
        { pacote_id: "p2", restricao_id: "r1" },
        { pacote_id: "p3", restricao_id: "r2" },
      ],
      [
        { id: "r1", obra_id: "A", tipo: null, status: "aberta", prazo: "2026-07-30" },
        { id: "r2", obra_id: "A", tipo: null, status: "aberta", prazo: "2026-06-01" },
      ],
      hoje,
    );
    expect(r).toEqual({ verde: 1, amarelo: 1, vermelho: 1 });
  });
});

describe("topCausasGlobal", () => {
  it("ranking com percentual", () => {
    const r = topCausasGlobal(
      [
        { id: "1", obra_id: "A", concluido: false, causa_chave: "mao_obra", semana_inicio: "" },
        { id: "2", obra_id: "A", concluido: false, causa_chave: "mao_obra", semana_inicio: "" },
        { id: "3", obra_id: "A", concluido: false, causa_chave: "clima", semana_inicio: "" },
        { id: "4", obra_id: "A", concluido: true, causa_chave: null, semana_inicio: "" },
      ],
      [{ chave: "mao_obra", label: "Mão de obra" }],
    );
    expect(r[0]).toEqual({ chave: "mao_obra", label: "Mão de obra", count: 2, pct: 2 / 3 });
    expect(r[1].chave).toBe("clima");
  });
});

describe("topRiscosCriticos", () => {
  it("ordena por P×I e filtra fechados", () => {
    const r = topRiscosCriticos([
      { id: "1", obra_id: "A", probabilidade: 5, impacto: 5, status: "aberto", descricao: "alto" },
      { id: "2", obra_id: "A", probabilidade: 2, impacto: 2, status: "aberto", descricao: "baixo" },
      { id: "3", obra_id: "A", probabilidade: 5, impacto: 5, status: "fechado", descricao: "x" },
    ]);
    expect(r.map((x) => x.id)).toEqual(["1", "2"]);
  });
});
