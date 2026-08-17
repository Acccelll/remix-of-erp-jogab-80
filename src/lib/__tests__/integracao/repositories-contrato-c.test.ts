/**
 * TST-002 (lote C) — Testes de integração dos repositories `board_listas`
 * (fatia canônica de `boards`) e `card_checklist_itens` / `card_membros` /
 * `card_setores` (fatias canônicas de `cardsExtra`).
 *
 * Estende `repositories-contrato-b.test.ts` (lote B). Mesma estratégia:
 * mock do cliente supabase que grava `from(...).op(...)` — sem banco.
 * Fecha o padrão dos repositórios usados pelo domínio Kanban/Cards.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

import { recorded, reset } from "./_duplo-supabase";

vi.mock("@/integrations/supabase/client", async () => {
  const { supabaseFalso } = await import("./_duplo-supabase");
  return { supabase: supabaseFalso };
});

import { boardListasRepo } from "@/lib/repositories/boards";
import {
  cardChecklistItensRepo,
  cardMembrosRepo,
  cardSetoresRepo,
} from "@/lib/repositories/cardsExtra";

describe("TST-002.c · boardListasRepo — contrato de query", () => {
  beforeEach(() => reset());

  it("create() emite insert em board_listas", async () => {
    reset({ data: null, error: null });
    await boardListasRepo.create({ nome: "A" } as any);
    const rec = recorded[0];
    expect(rec.table).toBe("board_listas");
    expect(rec.ops.find((o) => o.op === "insert")?.args[0]).toEqual({ nome: "A" });
  });

  it("create() propaga error do supabase", async () => {
    reset({ data: null, error: new Error("rls") });
    await expect(boardListasRepo.create({ nome: "A" } as any)).rejects.toThrow("rls");
  });

  it("insertMany() curto-circuita quando rows está vazio", async () => {
    reset({ data: null, error: null });
    await boardListasRepo.insertMany([]);
    expect(recorded.length).toBe(0);
  });

  it("insertMany() emite um insert com o array", async () => {
    reset({ data: null, error: null });
    await boardListasRepo.insertMany([{ nome: "A" } as any, { nome: "B" } as any]);
    const rec = recorded[0];
    expect(rec.table).toBe("board_listas");
    const insertOp = rec.ops.find((o) => o.op === "insert");
    expect(insertOp?.args[0]).toEqual([{ nome: "A" }, { nome: "B" }]);
  });

  it("update() encadeia update().eq(id) e propaga erro", async () => {
    reset({ data: null, error: new Error("nope") });
    await expect(boardListasRepo.update("l1", { nome: "y" } as any)).rejects.toThrow("nope");
    const rec = recorded[0];
    expect(rec.ops.map((o) => o.op)).toEqual(["update", "eq"]);
    expect(rec.ops[1].args).toEqual(["id", "l1"]);
  });

  it("updatePosicao() atualiza somente { posicao } via eq(id)", async () => {
    reset({ data: null, error: null });
    await boardListasRepo.updatePosicao("l9", 3);
    const rec = recorded[0];
    expect(rec.ops.map((o) => o.op)).toEqual(["update", "eq"]);
    expect(rec.ops[0].args[0]).toEqual({ posicao: 3 });
    expect(rec.ops[1].args).toEqual(["id", "l9"]);
  });
});

describe("TST-002.c · cardChecklistItensRepo — contrato de query", () => {
  beforeEach(() => reset());

  it("listByCard() seleciona colunas explícitas, filtra card_id e ordena por ordem", async () => {
    reset({ data: [{ id: "i1" }], error: null });
    const out = await cardChecklistItensRepo.listByCard("c1");
    expect(out).toEqual([{ id: "i1" }]);
    const rec = recorded[0];
    expect(rec.table).toBe("card_checklist_itens");
    expect(rec.ops.map((o) => o.op)).toEqual(["select", "eq", "order"]);
    expect(String(rec.ops[0].args[0])).toContain("id, card_id, texto");
    expect(rec.ops[1].args).toEqual(["card_id", "c1"]);
    expect(rec.ops[2].args[0]).toBe("ordem");
  });

  it("listByCard() propaga error via unwrap", async () => {
    reset({ data: null, error: new Error("boom") });
    await expect(cardChecklistItensRepo.listByCard("c1")).rejects.toThrow("boom");
  });

  it("insertMany() curto-circuita quando rows está vazio", async () => {
    reset({ data: null, error: null });
    const out = await cardChecklistItensRepo.insertMany([]);
    expect(out).toEqual({ data: null, error: null });
    expect(recorded.length).toBe(0);
  });

  it("setConcluido() atualiza somente { concluido } via eq(id)", async () => {
    reset({ data: null, error: null });
    await cardChecklistItensRepo.setConcluido("i1", true);
    const rec = recorded[0];
    expect(rec.ops.map((o) => o.op)).toEqual(["update", "eq"]);
    expect(rec.ops[0].args[0]).toEqual({ concluido: true });
    expect(rec.ops[1].args).toEqual(["id", "i1"]);
  });

  it("removeByCard() encadeia delete().eq(card_id)", async () => {
    reset({ data: null, error: null });
    await cardChecklistItensRepo.removeByCard("c9");
    const rec = recorded[0];
    expect(rec.ops.map((o) => o.op)).toEqual(["delete", "eq"]);
    expect(rec.ops[1].args).toEqual(["card_id", "c9"]);
  });
});

describe("TST-002.c · cardMembrosRepo — contrato de query", () => {
  beforeEach(() => reset());

  it("listUsers() seleciona user_id filtrando card_id", async () => {
    reset({ data: [{ user_id: "u1" }], error: null });
    const out = await cardMembrosRepo.listUsers("c1");
    expect(out).toEqual([{ user_id: "u1" }]);
    const rec = recorded[0];
    expect(rec.table).toBe("card_membros");
    expect(rec.ops.map((o) => o.op)).toEqual(["select", "eq"]);
    expect(rec.ops[0].args[0]).toBe("user_id");
    expect(rec.ops[1].args).toEqual(["card_id", "c1"]);
  });

  it("insert() emite insert com { card_id, user_id }", async () => {
    reset({ data: null, error: null });
    await cardMembrosRepo.insert("c1", "u2");
    const rec = recorded[0];
    expect(rec.table).toBe("card_membros");
    expect(rec.ops.find((o) => o.op === "insert")?.args[0]).toEqual({
      card_id: "c1",
      user_id: "u2",
    });
  });

  it("removeByCard() encadeia delete().eq(card_id)", async () => {
    reset({ data: null, error: null });
    await cardMembrosRepo.removeByCard("c3");
    const rec = recorded[0];
    expect(rec.ops.map((o) => o.op)).toEqual(["delete", "eq"]);
    expect(rec.ops[1].args).toEqual(["card_id", "c3"]);
  });
});

describe("TST-002.c · cardSetoresRepo — contrato de query", () => {
  beforeEach(() => reset());

  it("listByCard() seleciona colunas explícitas filtrando card_id", async () => {
    reset({ data: [], error: null });
    await cardSetoresRepo.listByCard("c1");
    const rec = recorded[0];
    expect(rec.table).toBe("card_setores");
    expect(rec.ops.map((o) => o.op)).toEqual(["select", "eq"]);
    expect(rec.ops[0].args[0]).toBe("card_id, setor, created_at");
    expect(rec.ops[1].args).toEqual(["card_id", "c1"]);
  });

  it("insertMany() curto-circuita quando rows está vazio", async () => {
    reset({ data: null, error: null });
    const out = await cardSetoresRepo.insertMany([]);
    expect(out).toEqual({ data: null, error: null });
    expect(recorded.length).toBe(0);
  });
});
