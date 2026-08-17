/**
 * TST-002 — Testes de integração da camada de repositories.
 *
 * Cobre o contrato "chamou a tabela certa com a operação certa e desembrulhou
 * `data`/`error` corretamente". Usa mock do cliente `supabase` — sem banco.
 * Pega regressões silenciosas do tipo "trocaram `.select` por `.insert`" ou
 * "esqueceram de desembrulhar o `error`".
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

import { recorded, reset } from "./_duplo-supabase";

vi.mock("@/integrations/supabase/client", async () => {
  const { supabaseFalso } = await import("./_duplo-supabase");
  return { supabase: supabaseFalso };
});

// Import after mock is registered.
import { obrasRepo } from "@/lib/repositories/obras";
import { fornecedoresRepo } from "@/lib/repositories/fornecedores";

describe("TST-002 · obrasRepo — contrato de query", () => {
  beforeEach(() => reset());

  // listResumo() removido em ARC-010.slice-07 — fonte única é `useObras()`.


  it("getById() usa eq(id) e retorna primeiro elemento", async () => {
    reset({ data: [{ id: "42", nome: "X", clientes: null }], error: null });
    const row = await obrasRepo.getById("42");
    expect(row?.id).toBe("42");
    const rec = recorded[0];
    expect(rec.table).toBe("obras");
    const eqOp = rec.ops.find((o) => o.op === "eq");
    expect(eqOp?.args).toEqual(["id", "42"]);
    expect(rec.ops.some((o) => o.op === "limit" && o.args[0] === 1)).toBe(true);
  });

  it("create() emite insert com o payload recebido", async () => {
    reset({ data: null, error: null });
    await obrasRepo.create({ nome: "Nova", codigo: "N-1" } as any);
    const rec = recorded[0];
    expect(rec.table).toBe("obras");
    const insertOp = rec.ops.find((o) => o.op === "insert");
    expect(insertOp?.args[0]).toEqual({ nome: "Nova", codigo: "N-1" });
  });

  it("update() encadeia update().eq(id) e propaga erro", async () => {
    reset({ data: null, error: new Error("denied") });
    await expect(obrasRepo.update("9", { nome: "y" } as any)).rejects.toThrow("denied");
    const rec = recorded[0];
    expect(rec.ops.map((o) => o.op)).toEqual(["update", "eq"]);
    expect(rec.ops[1].args).toEqual(["id", "9"]);
  });

  it("remove() encadeia delete().eq(id)", async () => {
    reset({ data: null, error: null });
    await obrasRepo.remove("z");
    const rec = recorded[0];
    expect(rec.ops.map((o) => o.op)).toEqual(["delete", "eq"]);
    expect(rec.ops[1].args).toEqual(["id", "z"]);
  });
});

describe("TST-002 · fornecedoresRepo — contrato de query", () => {
  beforeEach(() => reset());

  it("listResumo() seleciona id, razao_social ordenado", async () => {
    reset({ data: [], error: null });
    await fornecedoresRepo.listResumo();
    const rec = recorded[0];
    expect(rec.table).toBe("fornecedores");
    expect(rec.ops[0].args[0]).toBe("id, razao_social");
    expect(rec.ops[1].args[0]).toBe("razao_social");
  });

  it("create() propaga error do supabase", async () => {
    reset({ data: null, error: new Error("dup") });
    await expect(
      fornecedoresRepo.create({ razao_social: "X" } as any),
    ).rejects.toThrow("dup");
  });
});
