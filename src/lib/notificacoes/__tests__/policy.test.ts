import { describe, it, expect } from "vitest";

import { deveNotificarCriador, filtrarNotificacoesPorSetor, mesclarNotificacoes } from "../policy";

describe("deveNotificarCriador (PRO-030)", () => {
  it("não notifica quando a solicitação não tem criador registrado", () => {
    // Solicitações antigas foram criadas antes de `criado_por` existir.
    expect(deveNotificarCriador(null, "7")).toBe(false);
    expect(deveNotificarCriador(undefined, "7")).toBe(false);
    expect(deveNotificarCriador("", "7")).toBe(false);
    expect(deveNotificarCriador("   ", "7")).toBe(false);
  });

  it("não notifica quem comentou na própria solicitação", () => {
    expect(deveNotificarCriador("7", "7")).toBe(false);
  });

  it("notifica o criador quando quem comentou é outra pessoa", () => {
    expect(deveNotificarCriador("7", "9")).toBe(true);
  });

  it("compara ids do MySQL vindos como number ou string", () => {
    expect(deveNotificarCriador(7, "7")).toBe(false);
    expect(deveNotificarCriador("7", 7)).toBe(false);
    expect(deveNotificarCriador(" 7 ", 7)).toBe(false);
    expect(deveNotificarCriador(7, 9)).toBe(true);
  });

  it("notifica o criador quando não há autor identificado", () => {
    expect(deveNotificarCriador("7", null)).toBe(true);
    expect(deveNotificarCriador("7", undefined)).toBe(true);
  });
});

describe("mesclarNotificacoes (PRO-030)", () => {
  const n = (id: string, created_at: string) => ({ id, created_at });

  it("deduplica por id a linha que chega pelos dois caminhos", () => {
    // O caso do GM: é criador da solicitação E enxerga o setor avisado, então a
    // mesma linha volta na query de escopo e na de dirigidas.
    const linha = n("a", "2026-08-06T10:00:00Z");
    const out = mesclarNotificacoes([linha], [linha]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("a");
  });

  it("ordena por created_at desc, misturando as duas origens", () => {
    const out = mesclarNotificacoes(
      [n("a", "2026-08-06T10:00:00Z"), n("c", "2026-08-06T12:00:00Z")],
      [n("b", "2026-08-06T11:00:00Z")],
    );
    expect(out.map((x) => x.id)).toEqual(["c", "b", "a"]);
  });

  it("aceita listas vazias", () => {
    expect(mesclarNotificacoes([], [])).toEqual([]);
    expect(mesclarNotificacoes([n("a", "2026-08-06T10:00:00Z")], [])).toHaveLength(1);
    expect(mesclarNotificacoes([], [n("a", "2026-08-06T10:00:00Z")])).toHaveLength(1);
  });

  it("não muta as listas recebidas", () => {
    const escopo = [n("a", "2026-08-06T10:00:00Z")];
    const dirigidas = [n("b", "2026-08-06T11:00:00Z")];
    mesclarNotificacoes(escopo, dirigidas);
    expect(escopo).toHaveLength(1);
    expect(dirigidas).toHaveLength(1);
    expect(escopo[0].id).toBe("a");
  });
});

describe("filtrarNotificacoesPorSetor — não vaza aviso entre setores", () => {
  const podeVerSetor = (s: string) => s === "compras";

  it("mantém notificação sem setor (registros antigos)", () => {
    const out = filtrarNotificacoesPorSetor([{ setor: null, destinatario_id: null }], {
      podeVerSetor,
    });
    expect(out).toHaveLength(1);
  });

  it("esconde notificação de setor não concedido", () => {
    const out = filtrarNotificacoesPorSetor([{ setor: "dp", destinatario_id: null }], {
      podeVerSetor,
    });
    expect(out).toHaveLength(0);
  });

  it("mantém notificação do setor concedido", () => {
    const out = filtrarNotificacoesPorSetor([{ setor: "compras", destinatario_id: null }], {
      podeVerSetor,
    });
    expect(out).toHaveLength(1);
  });

  it("dirigida a mim passa mesmo sendo de outro setor", () => {
    const out = filtrarNotificacoesPorSetor([{ setor: "dp", destinatario_id: "7" }], {
      podeVerSetor,
      meusIds: ["7"],
    });
    expect(out).toHaveLength(1);
  });
});
