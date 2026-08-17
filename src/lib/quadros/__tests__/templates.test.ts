import { describe, it, expect } from "vitest";
import { listasDoTemplate, TEMPLATES_DISPONIVEIS } from "../templates";

describe("listasDoTemplate", () => {
  it("genérico tem 4 listas sequenciais começando em 0", () => {
    const ls = listasDoTemplate("generico");
    expect(ls.map((l) => l.nome)).toEqual(["A fazer", "Em andamento", "Aguardando", "Concluído"]);
    expect(ls.map((l) => l.posicao)).toEqual([0, 1, 2, 3]);
    expect(ls.every((l) => l.wip_limite === null)).toBe(true);
  });

  it("compras inclui WIP em Cotação", () => {
    const ls = listasDoTemplate("compras");
    expect(ls.find((l) => l.nome === "Cotação")?.wip_limite).toBe(5);
  });

  it("produção tem WIP=3 em Corte/Dobra/Solda", () => {
    const ls = listasDoTemplate("producao");
    for (const nome of ["Corte", "Dobra", "Solda"]) {
      expect(ls.find((l) => l.nome === nome)?.wip_limite).toBe(3);
    }
  });

  it("obra inclui Bloqueado", () => {
    const ls = listasDoTemplate("obra");
    expect(ls.find((l) => l.nome === "Bloqueado")).toBeTruthy();
  });

  it("template desconhecido cai em genérico", () => {
    // @ts-expect-error força fallback
    const ls = listasDoTemplate("inexistente");
    expect(ls).toHaveLength(4);
  });

  it("TEMPLATES_DISPONIVEIS expõe os 4 ids", () => {
    expect(TEMPLATES_DISPONIVEIS.map((t) => t.id).sort()).toEqual([
      "compras",
      "generico",
      "obra",
      "producao",
    ]);
  });
});
