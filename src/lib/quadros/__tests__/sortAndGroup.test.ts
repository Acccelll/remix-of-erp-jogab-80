import { describe, it, expect } from "vitest";
import {
  sortCards,
  groupCards,
  applyExtraFilters,
  type SortDef,
  type ExtraFilter,
} from "@/lib/quadros/sortAndGroup";

type Card = { id: string; nome: string; funcao: string; mob?: string };

const cards: Card[] = [
  { id: "1", nome: "Bruno", funcao: "Servente", mob: "2026-08-01" },
  { id: "2", nome: "Ana", funcao: "Pedreiro" },
  { id: "3", nome: "Carla", funcao: "Pedreiro", mob: "2026-07-15" },
];

const sortByNome: SortDef<Card> = {
  value: "nome",
  label: "Nome",
  compare: (a, b) => a.nome.localeCompare(b.nome, "pt-BR"),
};

describe("sortCards", () => {
  it("ordena ascendente sem mutar o array original", () => {
    const original = cards.slice();
    const out = sortCards(cards, sortByNome);
    expect(out.map((c) => c.id)).toEqual(["2", "1", "3"]);
    expect(cards).toEqual(original);
  });

  it("inverte com direction=desc", () => {
    const out = sortCards(cards, sortByNome, "desc");
    expect(out.map((c) => c.id)).toEqual(["3", "1", "2"]);
  });

  it("retorna o array original quando sort é nulo", () => {
    expect(sortCards(cards, null)).toBe(cards);
  });
});

describe("groupCards", () => {
  it("agrupa por chave alfabética e mantém ordem dos itens", () => {
    const out = groupCards(cards, (c) => c.funcao);
    expect(out.map((g) => g.key)).toEqual(["Pedreiro", "Servente"]);
    expect(out[0].items.map((c) => c.id)).toEqual(["2", "3"]);
    expect(out[1].items.map((c) => c.id)).toEqual(["1"]);
  });

  it("retorna um único grupo quando getGroupKey é nulo", () => {
    const out = groupCards(cards, null);
    expect(out).toHaveLength(1);
    expect(out[0].items).toBe(cards);
  });

  it("usa 'Sem categoria' quando a chave é vazia", () => {
    const out = groupCards([{ id: "x", nome: "X", funcao: "" }], (c) => c.funcao);
    expect(out[0].key).toBe("Sem categoria");
  });
});

describe("applyExtraFilters", () => {
  const filters: ExtraFilter<Card>[] = [
    { key: "tem-mob", label: "Com mobilização", predicate: (c) => !!c.mob },
    { key: "pedreiro", label: "Pedreiros", predicate: (c) => c.funcao === "Pedreiro" },
  ];

  it("retorna tudo quando nenhum filtro está ativo", () => {
    expect(applyExtraFilters(cards, filters, new Set())).toBe(cards);
  });

  it("aplica AND entre múltiplos filtros ativos", () => {
    const out = applyExtraFilters(cards, filters, new Set(["tem-mob", "pedreiro"]));
    expect(out.map((c) => c.id)).toEqual(["3"]);
  });

  it("ignora chaves que não correspondem a nenhum filtro", () => {
    const out = applyExtraFilters(cards, filters, new Set(["chave-inexistente"]));
    expect(out).toBe(cards);
  });
});
