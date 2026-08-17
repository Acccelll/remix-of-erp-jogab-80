import { describe, expect, it } from "vitest";

import {
  RANK_STEP,
  ordenarPorRank,
  precisaRecompactar,
  rankEntre,
  rankParaIndice,
  recompactar,
} from "../rank";

const item = (id: string, posicao: number) => ({ id, posicao });

describe("rank fracionário", () => {
  it("primeiro item recebe o passo padrão", () => {
    expect(rankEntre(null, null)).toBe(RANK_STEP);
  });

  it("insere no topo e no fim sem tocar nos vizinhos", () => {
    expect(rankEntre(null, 1024)).toBe(0);
    expect(rankEntre(1024, null)).toBe(2048);
  });

  it("insere no meio pela média", () => {
    expect(rankEntre(1024, 2048)).toBe(1536);
  });

  it("mover para índice produz rank entre os vizinhos corretos", () => {
    const lista = [item("a", 1024), item("b", 2048), item("c", 3072)];
    expect(rankParaIndice(lista, "c", 1)).toBe(1536);
    expect(rankParaIndice(lista, "a", 2)).toBe(4096); // a sai, fica após c
    expect(rankParaIndice(lista, "c", 0)).toBe(1024 - RANK_STEP);
  });

  it("mover uma vez altera apenas um registro", () => {
    const lista = [item("a", 1024), item("b", 2048), item("c", 3072)];
    const novo = rankParaIndice(lista, "c", 1);
    const alterados = lista
      .map((i) => (i.id === "c" ? { ...i, posicao: novo } : i))
      .filter((i, idx) => i.posicao !== lista[idx].posicao);
    expect(alterados).toHaveLength(1);
  });

  it("detecta colapso de precisão", () => {
    expect(precisaRecompactar(1, 2)).toBe(false);
    expect(precisaRecompactar(1, 1 + 1e-9)).toBe(true);
    expect(precisaRecompactar(null, 1)).toBe(false);
  });

  it("recompacta devolvendo só o que mudou", () => {
    const lista = [item("a", 1024), item("b", 1024.0000001), item("c", 5)];
    const ordenada = ordenarPorRank(lista);
    const mudancas = recompactar(ordenada);
    expect(mudancas.map((m) => m.id)).toEqual(["c", "a", "b"]);
    expect(mudancas.map((m) => m.posicao)).toEqual([1024, 2048, 3072]);
  });

  it("ordenação é estável e determinística em empate", () => {
    const a = ordenarPorRank([item("b", 1), item("a", 1)]);
    expect(a.map((i) => i.id)).toEqual(["a", "b"]);
  });
});
