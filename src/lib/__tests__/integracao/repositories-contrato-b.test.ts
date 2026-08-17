/**
 * TST-002 (lote B) — Testes de integração dos repositories `clientes` e `insumos`.
 *
 * Estende `repositories-contrato.test.ts` (lote A) para avançar a pré-condição
 * de desbloqueio da Onda 6 (Stage Gate exige TST-002 em curso).
 *
 * Estratégia idêntica ao lote A: mock do cliente supabase que grava
 * `from(...).op(...)` e devolve resultado configurável — sem banco.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

import { recorded, reset } from "./_duplo-supabase";

vi.mock("@/integrations/supabase/client", async () => {
  const { supabaseFalso } = await import("./_duplo-supabase");
  return { supabase: supabaseFalso };
});

import { clientesRepo } from "@/lib/repositories/clientes";
import { insumosRepo } from "@/lib/repositories/insumos";

describe("TST-002.b · clientesRepo — contrato de query", () => {
  beforeEach(() => reset());

  it("list() lê tabela clientes com select amplo e order(nome)", async () => {
    reset({ data: [{ id: "1", nome: "A" }], error: null });
    const out = await clientesRepo.list();
    expect(out).toEqual([{ id: "1", nome: "A" }]);
    const rec = recorded[0];
    expect(rec.table).toBe("clientes");
    expect(rec.ops.map((o) => o.op)).toEqual(["select", "order"]);
    expect(String(rec.ops[0].args[0])).toContain("id, nome");
    expect(rec.ops[1].args[0]).toBe("nome");
  });

  it("list() devolve [] quando data é null", async () => {
    reset({ data: null, error: null });
    expect(await clientesRepo.list()).toEqual([]);
  });

  it("list() propaga error do supabase", async () => {
    reset({ data: null, error: new Error("rls") });
    await expect(clientesRepo.list()).rejects.toThrow("rls");
  });

  it("listIdNome() usa projeção mínima id,nome", async () => {
    reset({ data: [], error: null });
    await clientesRepo.listIdNome();
    expect(recorded[0].ops[0].args[0]).toBe("id,nome");
  });

  it("create() emite insert com o payload recebido", async () => {
    reset({ data: null, error: null });
    await clientesRepo.create({ nome: "Novo" } as any);
    const rec = recorded[0];
    expect(rec.table).toBe("clientes");
    const insertOp = rec.ops.find((o) => o.op === "insert");
    expect(insertOp?.args[0]).toEqual({ nome: "Novo" });
  });

  it("update() encadeia update().eq(id) e propaga erro", async () => {
    reset({ data: null, error: new Error("nope") });
    await expect(clientesRepo.update("7", { nome: "y" } as any)).rejects.toThrow("nope");
    const rec = recorded[0];
    expect(rec.ops.map((o) => o.op)).toEqual(["update", "eq"]);
    expect(rec.ops[1].args).toEqual(["id", "7"]);
  });

  it("remove() encadeia delete().eq(id)", async () => {
    reset({ data: null, error: null });
    await clientesRepo.remove("k");
    const rec = recorded[0];
    expect(rec.ops.map((o) => o.op)).toEqual(["delete", "eq"]);
    expect(rec.ops[1].args).toEqual(["id", "k"]);
  });
});

describe("TST-002.b · insumosRepo — contrato de query", () => {
  beforeEach(() => reset());

  it("listAtivos() filtra ativo=true e ordena por descricao", async () => {
    reset({ data: [{ id: "1" }], error: null });
    await insumosRepo.listAtivos();
    const rec = recorded[0];
    expect(rec.table).toBe("insumos");
    expect(rec.ops.map((o) => o.op)).toEqual(["select", "eq", "order", "limit"]);
    expect(rec.ops[0].args[0]).toBe("id, descricao, unidade, preco_unitario, ativo");
    expect(rec.ops[1].args).toEqual(["ativo", true]);
    expect(rec.ops[2].args[0]).toBe("descricao");
  });

  it("listAtivos() devolve [] quando data é null", async () => {
    reset({ data: null, error: null });
    expect(await insumosRepo.listAtivos()).toEqual([]);
  });

  it("listAtivos() propaga error via unwrap", async () => {
    reset({ data: null, error: new Error("boom") });
    await expect(insumosRepo.listAtivos()).rejects.toThrow("boom");
  });

  it("listPrecos() seleciona apenas id,preco_unitario", async () => {
    reset({ data: [], error: null });
    await insumosRepo.listPrecos();
    expect(recorded[0].ops[0].args[0]).toBe("id, preco_unitario");
  });

  it("create() emite insert na tabela insumos", async () => {
    reset({ data: null, error: null });
    await insumosRepo.create({ descricao: "X" } as any);
    expect(recorded[0].table).toBe("insumos");
    expect(recorded[0].ops.find((o) => o.op === "insert")?.args[0]).toEqual({ descricao: "X" });
  });

  it("update() encadeia update().eq(id)", async () => {
    reset({ data: null, error: null });
    await insumosRepo.update("i1", { descricao: "Y" } as any);
    const rec = recorded[0];
    expect(rec.ops.map((o) => o.op)).toEqual(["update", "eq"]);
    expect(rec.ops[1].args).toEqual(["id", "i1"]);
  });

  it("toggleAtivo() atualiza somente { ativo } via eq(id)", async () => {
    reset({ data: null, error: null });
    await insumosRepo.toggleAtivo("i9", false);
    const rec = recorded[0];
    expect(rec.ops.map((o) => o.op)).toEqual(["update", "eq"]);
    expect(rec.ops[0].args[0]).toEqual({ ativo: false });
    expect(rec.ops[1].args).toEqual(["id", "i9"]);
  });
});
