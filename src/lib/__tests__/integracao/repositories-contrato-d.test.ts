/**
 * TST-002 (lote D) — Testes de integração dos repositories `cronograma` e
 * `requisicoes` (domínio de obras que ARC-005 vai reestruturar na Onda 6).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

import { recorded, reset } from "./_duplo-supabase";

vi.mock("@/integrations/supabase/client", async () => {
  const { supabaseFalso } = await import("./_duplo-supabase");
  return { supabase: supabaseFalso };
});

import {
  cronogramaRepo,
  cronogramaItemRevisoesRepo,
} from "@/lib/repositories/cronograma";
import { requisicoesRepo } from "@/lib/repositories/requisicoes";

describe("TST-002.d · cronogramaRepo — contrato de query", () => {
  beforeEach(() => reset());

  it("listByObra() usa colunas completas, filtra obra_id e ordena por data_inicio", async () => {
    reset({ data: [{ id: "1" }], error: null });
    const out = await cronogramaRepo.listByObra("o1");
    expect(out).toEqual([{ id: "1" }]);
    const rec = recorded[0];
    expect(rec.table).toBe("cronograma_itens");
    expect(rec.ops.map((o) => o.op)).toEqual(["select", "eq", "order"]);
    expect(String(rec.ops[0].args[0])).toContain("id, obra_id, descricao");
    expect(rec.ops[1].args).toEqual(["obra_id", "o1"]);
    expect(rec.ops[2].args[0]).toBe("data_inicio");
  });

  it("listByObra() devolve [] quando data é null", async () => {
    reset({ data: null, error: null });
    expect(await cronogramaRepo.listByObra("o1")).toEqual([]);
  });

  it("listByObra() propaga error via unwrap", async () => {
    reset({ data: null, error: new Error("rls") });
    await expect(cronogramaRepo.listByObra("o1")).rejects.toThrow("rls");
  });

  it("listDashboard() seleciona colunas mínimas de dashboard", async () => {
    reset({ data: [], error: null });
    await cronogramaRepo.listDashboard();
    const rec = recorded[0];
    expect(rec.table).toBe("cronograma_itens");
    expect(String(rec.ops[0].args[0])).toContain("custo_baseline");
    expect(String(rec.ops[0].args[0])).toContain("percentual_previsto");
    // O Dashboard mostra só item ativo, e o PostgREST corta a resposta em
    // 1.000 — sem o range, obras a partir da ~3ª voltavam sem item nenhum.
    expect(rec.ops.map((o) => o.op)).toEqual(["select", "neq", "order", "order", "range"]);
    expect(rec.ops[1].args).toEqual(["ativo", false]);
    expect(rec.ops[4].args).toEqual([0, 999]);
  });

  it("insertMany() curto-circuita quando rows está vazio", async () => {
    reset({ data: null, error: null });
    await cronogramaRepo.insertMany([]);
    expect(recorded.length).toBe(0);
  });

  it("update() encadeia update().eq(id) e propaga erro", async () => {
    reset({ data: null, error: new Error("nope") });
    await expect(cronogramaRepo.update("i1", { descricao: "x" } as any)).rejects.toThrow("nope");
    const rec = recorded[0];
    expect(rec.ops.map((o) => o.op)).toEqual(["update", "eq"]);
    expect(rec.ops[1].args).toEqual(["id", "i1"]);
  });

  it("removeByObra() encadeia delete().eq(obra_id)", async () => {
    reset({ data: null, error: null });
    await cronogramaRepo.removeByObra("o9");
    const rec = recorded[0];
    expect(rec.ops.map((o) => o.op)).toEqual(["delete", "eq"]);
    expect(rec.ops[1].args).toEqual(["obra_id", "o9"]);
  });

  it("removeMany() usa delete().in('id', ids); curto-circuita se vazio", async () => {
    reset({ data: null, error: null });
    await cronogramaRepo.removeMany([]);
    expect(recorded.length).toBe(0);
    await cronogramaRepo.removeMany(["a", "b"]);
    const rec = recorded[0];
    expect(rec.ops.map((o) => o.op)).toEqual(["delete", "in"]);
    expect(rec.ops[1].args).toEqual(["id", ["a", "b"]]);
  });
});

describe("TST-002.d · cronogramaItemRevisoesRepo — contrato de query", () => {
  beforeEach(() => reset());

  it("removeByRevisao() encadeia delete().eq(revisao_id) e propaga erro", async () => {
    reset({ data: null, error: new Error("denied") });
    await expect(cronogramaItemRevisoesRepo.removeByRevisao("r1")).rejects.toThrow("denied");
    const rec = recorded[0];
    expect(rec.table).toBe("cronograma_item_revisoes");
    expect(rec.ops.map((o) => o.op)).toEqual(["delete", "eq"]);
    expect(rec.ops[1].args).toEqual(["revisao_id", "r1"]);
  });

  it("removeByRevisaoIds() curto-circuita quando vazio", async () => {
    reset({ data: null, error: null });
    await cronogramaItemRevisoesRepo.removeByRevisaoIds([]);
    expect(recorded.length).toBe(0);
  });
});

describe("TST-002.d · requisicoesRepo — contrato de query", () => {
  beforeEach(() => reset());

  it("listAll() usa colunas padrão e order(created_at desc)", async () => {
    reset({ data: [{ id: "r1" }], error: null });
    const out = await requisicoesRepo.listAll();
    expect(out).toEqual([{ id: "r1" }]);
    const rec = recorded[0];
    expect(rec.table).toBe("requisicoes");
    expect(rec.ops.map((o) => o.op)).toEqual(["select", "order", "limit"]);
    expect(String(rec.ops[0].args[0])).toContain("id, obra_id, card_recurso_id");
    expect(rec.ops[1].args).toEqual(["created_at", { ascending: false }]);
  });

  it("listAll() propaga error do supabase", async () => {
    reset({ data: null, error: new Error("boom") });
    await expect(requisicoesRepo.listAll()).rejects.toThrow("boom");
  });

  it("listResumoObra() aplica limit(default=500)", async () => {
    reset({ data: [], error: null });
    await requisicoesRepo.listResumoObra();
    const rec = recorded[0];
    expect(rec.ops.map((o) => o.op)).toEqual(["select", "limit"]);
    expect(rec.ops[0].args[0]).toBe("id, obra_id, observacao");
    expect(rec.ops[1].args).toEqual([500]);
  });

  it("updateStatus() atualiza apenas { status } via eq(id)", async () => {
    reset({ data: null, error: null });
    await requisicoesRepo.updateStatus("r1", "aprovada");
    const rec = recorded[0];
    expect(rec.ops.map((o) => o.op)).toEqual(["update", "eq"]);
    expect(rec.ops[0].args[0]).toEqual({ status: "aprovada" });
    expect(rec.ops[1].args).toEqual(["id", "r1"]);
  });

  it("update() encadeia update().eq(id) e propaga erro", async () => {
    reset({ data: null, error: new Error("nope") });
    await expect(requisicoesRepo.update("r1", { observacao: "x" } as any)).rejects.toThrow("nope");
  });

  it("create() emite insert com o payload recebido", async () => {
    reset({ data: null, error: null });
    await requisicoesRepo.create({ obra_id: "o1" } as any);
    const rec = recorded[0];
    expect(rec.table).toBe("requisicoes");
    expect(rec.ops.find((o) => o.op === "insert")?.args[0]).toEqual({ obra_id: "o1" });
  });
});
