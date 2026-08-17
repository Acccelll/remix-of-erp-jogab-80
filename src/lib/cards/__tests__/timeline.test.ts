import { describe, it, expect } from "vitest";
import {
  montarTimeline,
  resolverPai,
  resumoCitacao,
  type ComentarioBase,
  type AtividadeBase,
} from "@/lib/cards/timeline";

const t = (s: string) => new Date(`2026-06-30T${s}Z`).toISOString();

type ComentTest = ComentarioBase & { autor_id: string };
type AtivTest = AtividadeBase & { tipo: string; payload: unknown; ator_id: string };

const coments: ComentTest[] = [
  { id: "c1", texto: "primeiro", autor_id: "u1", created_at: t("10:00:00") },
  { id: "c2", texto: "resposta ao c1", autor_id: "u2", created_at: t("10:05:00"), reply_to: "c1" },
  { id: "c3", texto: "depois da atividade", autor_id: "u1", created_at: t("10:20:00") },
];

const ativs: AtivTest[] = [
  { id: "a1", tipo: "status", payload: {}, ator_id: "u1", created_at: t("10:02:00") },
  { id: "a2", tipo: "prazo", payload: {}, ator_id: "u1", created_at: t("10:10:00") },
  // Mesmo timestamp que c2 → comentário deve vir antes.
  { id: "a3", tipo: "etiquetas", payload: {}, ator_id: "u2", created_at: t("10:05:00") },
];

describe("montarTimeline", () => {
  it("modo resumido: apenas comentários, asc", () => {
    const out = montarTimeline(coments, ativs, { detalhes: false });
    expect(out.map((x) => x.kind)).toEqual(["comentario", "comentario", "comentario"]);
    expect(out.map((x) => x.data.id)).toEqual(["c1", "c2", "c3"]);
  });

  it("modo detalhado: intercala comentários e atividades por timestamp", () => {
    const out = montarTimeline(coments, ativs, { detalhes: true });
    expect(out.map((x) => x.data.id)).toEqual(["c1", "a1", "c2", "a3", "a2", "c3"]);
  });

  it("empate de timestamp: comentário antes de atividade", () => {
    const out = montarTimeline(coments, ativs, { detalhes: true });
    const ic2 = out.findIndex((x) => x.data.id === "c2");
    const ia3 = out.findIndex((x) => x.data.id === "a3");
    expect(ic2).toBeLessThan(ia3);
  });

  it("entrada vazia não quebra", () => {
    expect(montarTimeline([], [], { detalhes: true })).toEqual([]);
    expect(montarTimeline([], [], { detalhes: false })).toEqual([]);
  });
});

describe("resolverPai", () => {
  it("encontra o pai pelo id", () => {
    expect(resolverPai(coments, "c1")?.id).toBe("c1");
  });
  it("retorna null quando reply_to é vazio", () => {
    expect(resolverPai(coments, null)).toBeNull();
    expect(resolverPai(coments, undefined)).toBeNull();
  });
  it("retorna null quando pai foi apagado", () => {
    expect(resolverPai(coments, "inexistente")).toBeNull();
  });
});

describe("resumoCitacao", () => {
  it("corta no limite com elipse", () => {
    expect(resumoCitacao("a".repeat(200), 50)).toHaveLength(50);
    expect(resumoCitacao("a".repeat(200), 50).endsWith("…")).toBe(true);
  });
  it("colapsa espaços", () => {
    expect(resumoCitacao("ola   mundo\n\nfoo")).toBe("ola mundo foo");
  });
  it("vazio vira string vazia", () => {
    expect(resumoCitacao(null)).toBe("");
    expect(resumoCitacao("   ")).toBe("");
  });
});
