import { describe, expect, it } from "vitest";
import {
  automacoesMovimentacaoQuadro,
  chaveExecucaoAutomacaoQuadro,
  listarRegrasAutomacaoQuadro,
  normalizarRegrasAutomacaoDesativadas,
} from "../automacoesQuadro";

const base = {
  cardId: "card-1",
  numero: 42,
  titulo: "Vergalhão CA-50",
  tipoRecurso: "material",
} as const;

describe("automacoesMovimentacaoQuadro (PRO-027.slice-01)", () => {
  it("gera comentário quando Compras avança para pedido emitido", () => {
    const acoes = automacoesMovimentacaoQuadro({
      ...base,
      setor: "Compras",
      deStatus: "em_cotacao",
      paraStatus: "pedido_emitido",
    });

    expect(acoes).toHaveLength(1);
    expect(acoes[0]).toMatchObject({
      id: "compras.pedido_emitido.comentario",
      tipo: "comentario",
    });
    expect(acoes[0].texto).toContain("#42");
    expect(acoes[0].texto).toContain("Pedido emitido");
  });

  it("gera comentário quando Produção inicia fabricação", () => {
    const acoes = automacoesMovimentacaoQuadro({
      ...base,
      setor: "Producao",
      deStatus: "aguardando_material",
      paraStatus: "em_fabricacao",
    });

    expect(acoes).toEqual([
      expect.objectContaining({
        id: "producao.em_fabricacao.comentario",
        tipo: "comentario",
      }),
    ]);
  });

  it("não gera ação para movimentação sem regra ou sem troca real", () => {
    expect(
      automacoesMovimentacaoQuadro({
        ...base,
        setor: "Compras",
        deStatus: "identificado",
        paraStatus: "em_cotacao",
      }),
    ).toEqual([]);

    expect(
      automacoesMovimentacaoQuadro({
        ...base,
        setor: "Producao",
        deStatus: "produzido",
        paraStatus: "produzido",
      }),
    ).toEqual([]);
  });

  it("cria chave estável de execução por card, setor, destino e ação", () => {
    expect(
      chaveExecucaoAutomacaoQuadro(
        { cardId: "card-1", setor: "Compras", paraStatus: "pedido_emitido" },
        "compras.pedido_emitido.comentario",
      ),
    ).toBe("card-1:Compras:pedido_emitido:compras.pedido_emitido.comentario");
  });

  it("permite desativar regra nativa por id", () => {
    const acoes = automacoesMovimentacaoQuadro(
      {
        ...base,
        setor: "Compras",
        deStatus: "em_cotacao",
        paraStatus: "pedido_emitido",
      },
      { regrasDesativadas: ["compras.pedido_emitido.comentario"] },
    );

    expect(acoes).toEqual([]);
  });

  it("lista regras por setor e normaliza ids conhecidos", () => {
    expect(listarRegrasAutomacaoQuadro("Producao").map((regra) => regra.id)).toEqual([
      "producao.em_fabricacao.comentario",
      "producao.entregue_obra.comentario",
    ]);

    expect(
      normalizarRegrasAutomacaoDesativadas([
        "producao.em_fabricacao.comentario",
        "desconhecida",
        "producao.em_fabricacao.comentario",
        123,
      ]),
    ).toEqual(["producao.em_fabricacao.comentario"]);
  });
});
