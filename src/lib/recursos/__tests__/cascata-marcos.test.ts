import { describe, it, expect } from "vitest";
import { calcularCascataLinha, piorSeveridade, type CardCascataInput } from "../cascata-marcos";

const HOJE = new Date("2026-06-24T12:00:00Z");

function card(over: Partial<CardCascataInput>): CardCascataInput {
  return {
    card_id: "c1",
    status_card: "ativo",
    arquivado: false,
    tipo_recurso: "material_pronto",
    prazo_notif_compras: null,
    prazo_pedido: null,
    prazo_prod_iniciar: null,
    prazo_notif_producao: null,
    data_necessidade_obra: null,
    ...over,
  };
}

describe("calcularCascataLinha", () => {
  it("retorna null se nenhum card ativo", () => {
    expect(calcularCascataLinha([], HOJE)).toBeNull();
    expect(
      calcularCascataLinha(
        [card({ status_card: "concluido", data_necessidade_obra: "2026-07-01" })],
        HOJE,
      ),
    ).toBeNull();
    expect(
      calcularCascataLinha([card({ arquivado: true, data_necessidade_obra: "2026-07-01" })], HOJE),
    ).toBeNull();
  });

  it("retorna null se nenhuma data utilizável", () => {
    expect(calcularCascataLinha([card({})], HOJE)).toBeNull();
  });

  it("consolida a data mais cedo entre cards por tipo de marco", () => {
    const linha = calcularCascataLinha(
      [
        card({ numero: 10, prazo_pedido: "2026-07-10", data_necessidade_obra: "2026-08-01" }),
        card({ card_id: "c2", numero: 11, prazo_pedido: "2026-07-05", data_necessidade_obra: "2026-07-30" }),
      ],
      HOJE,
    )!;
    expect(linha.marcos.find((m) => m.kind === "pedido")?.data).toBe("2026-07-05");
    expect(linha.marcos.find((m) => m.kind === "pedido")?.fontes).toEqual([
      { card_id: "c2", numero: 11, titulo: null },
    ]);
    expect(linha.marcos.find((m) => m.kind === "necessidade")?.data).toBe("2026-07-30");
  });

  it("ignora trilho de produção para tipos não-manufaturados", () => {
    const linha = calcularCascataLinha(
      [
        card({
          tipo_recurso: "material_pronto",
          prazo_prod_iniciar: "2026-06-30",
          data_necessidade_obra: "2026-07-30",
        }),
      ],
      HOJE,
    )!;
    expect(linha.marcos.some((m) => m.kind === "prod_iniciar")).toBe(false);
  });

  it("inclui trilho de produção para manufaturado", () => {
    const linha = calcularCascataLinha(
      [
        card({
          tipo_recurso: "manufaturado",
          prazo_prod_iniciar: "2026-06-30",
          prazo_notif_producao: "2026-06-26",
          data_necessidade_obra: "2026-07-30",
        }),
      ],
      HOJE,
    )!;
    expect(linha.marcos.find((m) => m.kind === "prod_iniciar")?.data).toBe("2026-06-30");
    expect(linha.marcos.find((m) => m.kind === "notif_producao")?.data).toBe("2026-06-26");
  });

  it("classifica severidade por dias até o marco", () => {
    const linha = calcularCascataLinha(
      [
        card({
          prazo_notif_compras: "2026-06-20", // vencido (-4)
          prazo_pedido: "2026-06-26", // urgente (+2)
          data_necessidade_obra: "2026-07-30", // ok (+36)
        }),
      ],
      HOJE,
    )!;
    expect(linha.marcos.find((m) => m.kind === "notif_compras")?.severidade).toBe("vencido");
    expect(linha.marcos.find((m) => m.kind === "pedido")?.severidade).toBe("urgente");
    expect(linha.marcos.find((m) => m.kind === "necessidade")?.severidade).toBe("ok");
    expect(piorSeveridade(linha)).toBe("vencido");
  });

  it("ordena marcos por data ascendente", () => {
    const linha = calcularCascataLinha(
      [
        card({
          prazo_notif_compras: "2026-06-26",
          prazo_pedido: "2026-07-02",
          data_necessidade_obra: "2026-07-30",
        }),
      ],
      HOJE,
    )!;
    expect(linha.marcos.map((m) => m.kind)).toEqual(["notif_compras", "pedido", "necessidade"]);
  });
});
