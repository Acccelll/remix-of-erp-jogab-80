import { describe, it, expect, beforeEach } from "vitest";
import { runOnMove, type Automacao } from "../automacoes";

const base: Omit<Automacao, "id" | "gatilho"> = {
  boardId: "b1",
  ativa: true,
  nome: "Aviso concluído",
  acoes: [{ tipo: "notificar", mensagem: "Card concluído" }],
  criadaEm: new Date().toISOString(),
};

const reg = (id: string, listaId: string, over: Partial<Automacao> = {}): Automacao => ({
  ...base,
  ...over,
  id,
  gatilho: { tipo: "card_movido_para_lista", listaId },
});

describe("PRO-027 · runOnMove", () => {
  beforeEach(() => localStorage.clear());

  it("dispara ação quando o card cai na lista alvo", () => {
    const acoes = runOnMove([reg("a1", "L-concluido")], {
      boardId: "b1",
      cardId: "c1",
      listaDestinoId: "L-concluido",
    });
    expect(acoes).toEqual([{ tipo: "notificar", mensagem: "Card concluído" }]);
  });

  it("ignora regras inativas, de outro board ou de outra lista", () => {
    const acoes = runOnMove(
      [
        reg("a1", "L-concluido", { ativa: false }),
        reg("a2", "L-outra"),
        reg("a3", "L-concluido", { boardId: "b2" }),
      ],
      { boardId: "b1", cardId: "c1", listaDestinoId: "L-concluido" },
    );
    expect(acoes).toEqual([]);
  });

  it("filtra por board sem depender de persistência local", () => {
    const regras = [reg("a1", "L1"), reg("a2", "L1", { boardId: "b2" })];
    const acoes = runOnMove(regras, { boardId: "b1", cardId: "c1", listaDestinoId: "L1" });
    expect(acoes).toHaveLength(1);
  });
});

import { runOnVencimento, presetsForTemplate, type Automacao as A2 } from "../automacoes";

describe("PRO-027 · runOnVencimento", () => {
  const regra: A2 = {
    id: "v1",
    boardId: "b1",
    ativa: true,
    nome: "Aviso",
    gatilho: { tipo: "card_vencendo", diasAntes: 3 },
    acoes: [{ tipo: "notificar", mensagem: "Vence em breve" }],
    criadaEm: new Date().toISOString(),
  };

  it("dispara para cards dentro da janela", () => {
    const acoes = runOnVencimento(
      [regra],
      [
        { id: "c1", data_fim: "2026-07-16" }, // 2 dias
        { id: "c2", data_fim: "2026-07-20" }, // 6 dias
        { id: "c3", data_fim: null },
      ],
      { boardId: "b1", hoje: "2026-07-14" },
    );
    expect(acoes.map((a) => a.cardId)).toEqual(["c1"]);
  });

  it("dispara também para cards vencidos", () => {
    const acoes = runOnVencimento(
      [regra],
      [{ id: "c1", data_fim: "2026-07-10" }],
      { boardId: "b1", hoje: "2026-07-14" },
    );
    expect(acoes).toHaveLength(1);
  });
});

describe("PRO-027 · presetsForTemplate", () => {
  it("obras traz vencimento e bloqueado", () => {
    const p = presetsForTemplate("obras");
    expect(p.length).toBeGreaterThanOrEqual(2);
    expect(p.some((r) => r.gatilho.tipo === "card_vencendo")).toBe(true);
  });
  it("template desconhecido retorna default", () => {
    expect(presetsForTemplate("xyz")).toHaveLength(1);
  });
});
