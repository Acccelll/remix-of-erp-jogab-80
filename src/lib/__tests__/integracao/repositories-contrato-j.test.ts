/**
 * TST-002 (lote J) — Contratos de `clientesRepo` e `fornecedoresRepo`.
 * Fixa colunas, filtros, ordenações e count antes das refatorações de
 * compras/financeiro.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

import { recorded, reset } from "./_duplo-supabase";

vi.mock("@/integrations/supabase/client", async () => {
  const { supabaseFalso } = await import("./_duplo-supabase");
  return { supabase: supabaseFalso };
});

import { clientesRepo } from "@/lib/repositories/clientes";
import { fornecedoresRepo } from "@/lib/repositories/fornecedores";

const CLIENTES_COLS =
  "id, nome, nome_fantasia, cnpj, telefone, email, cep, logradouro, numero, complemento, bairro, municipio, uf, observacoes, prazo_emitir_nf_dias, prazo_pagamento_dias, dia_fixo_pagamento, dias_fixos_pagamento, aliquota_iss, aliquota_inss, aliquota_cbs, aliquota_ibs, percentual_material, owner_id, created_at, updated_at";

describe("TST-002.j · clientesRepo", () => {
  beforeEach(() => reset());

  it("list() usa colunas explícitas completas e ordena por nome", async () => {
    reset({ data: [{ id: "c1" }], error: null });
    const out = await clientesRepo.list();

    expect(out).toEqual([{ id: "c1" }]);
    const rec = recorded[0];
    expect(rec.table).toBe("clientes");
    expect(rec.ops.map((o) => o.op)).toEqual(["select", "order"]);
    expect(rec.ops[0].args[0]).toBe(CLIENTES_COLS);
    expect(rec.ops[1].args).toEqual(["nome"]);
  });

  it("list() devolve [] quando data é null", async () => {
    reset({ data: null, error: null });
    expect(await clientesRepo.list()).toEqual([]);
  });

  it("list() propaga erro", async () => {
    reset({ data: null, error: new Error("db") });
    await expect(clientesRepo.list()).rejects.toThrow("db");
  });

  it("listIdNome() usa projeção mínima 'id,nome' e ordena por nome", async () => {
    reset({ data: null, error: null });
    const out = await clientesRepo.listIdNome();
    expect(out).toEqual([]);
    expect(recorded[0].ops).toEqual([
      { op: "select", args: ["id,nome"] },
      { op: "order", args: ["nome"] },
    ]);
  });

  it("create() faz insert simples", async () => {
    await clientesRepo.create({ nome: "X" } as any);
    expect(recorded[0].table).toBe("clientes");
    expect(recorded[0].ops[0]).toEqual({ op: "insert", args: [{ nome: "X" }] });
  });

  it("create() propaga erro", async () => {
    reset({ data: null, error: new Error("i") });
    await expect(clientesRepo.create({} as any)).rejects.toThrow("i");
  });

  it("update() aplica patch por id", async () => {
    await clientesRepo.update("c1", { nome: "Y" } as any);
    expect(recorded[0].ops).toEqual([
      { op: "update", args: [{ nome: "Y" }] },
      { op: "eq", args: ["id", "c1"] },
    ]);
  });

  it("remove() delete por id", async () => {
    await clientesRepo.remove("c1");
    expect(recorded[0].ops).toEqual([
      { op: "delete", args: [] },
      { op: "eq", args: ["id", "c1"] },
    ]);
  });

  it("countObrasVinculadas() usa obras + head:true e filtra cliente_id", async () => {
    reset({ data: null, error: null, count: 7 });
    const n = await clientesRepo.countObrasVinculadas("c1");
    expect(n).toBe(7);
    const rec = recorded[0];
    expect(rec.table).toBe("obras");
    expect(rec.ops).toEqual([
      { op: "select", args: ["id", { count: "exact", head: true }] },
      { op: "eq", args: ["cliente_id", "c1"] },
    ]);
  });

  it("countObrasVinculadas() devolve 0 quando count é null", async () => {
    reset({ data: null, error: null, count: null as any });
    expect(await clientesRepo.countObrasVinculadas("c1")).toBe(0);
  });

  it("countObrasVinculadas() propaga erro", async () => {
    reset({ data: null, error: new Error("c"), count: null as any });
    await expect(clientesRepo.countObrasVinculadas("c1")).rejects.toThrow("c");
  });
});

describe("TST-002.j · fornecedoresRepo", () => {
  beforeEach(() => reset());

  it("listResumo() usa 'id, razao_social' e ordena por razao_social", async () => {
    reset({ data: [{ id: "f1", razao_social: "A" }], error: null });
    const out = await fornecedoresRepo.listResumo();

    expect(out).toEqual([{ id: "f1", razao_social: "A" }]);
    const rec = recorded[0];
    expect(rec.table).toBe("fornecedores");
    expect(rec.ops).toEqual([
      { op: "select", args: ["id, razao_social"] },
      { op: "order", args: ["razao_social"] },
      { op: "limit", args: [expect.any(Number)] },
    ]);
  });

  it("listResumo() devolve [] em data null", async () => {
    reset({ data: null, error: null });
    expect(await fornecedoresRepo.listResumo()).toEqual([]);
  });

  it("listResumo() propaga erro", async () => {
    reset({ data: null, error: new Error("f") });
    await expect(fornecedoresRepo.listResumo()).rejects.toThrow("f");
  });

  it("listResumoAtivos() inclui coluna ativo", async () => {
    await fornecedoresRepo.listResumoAtivos();
    expect(recorded[0].ops).toEqual([
      { op: "select", args: ["id, razao_social, ativo"] },
      { op: "order", args: ["razao_social"] },
      { op: "limit", args: [expect.any(Number)] },
    ]);
  });

  it("create() insere em fornecedores", async () => {
    await fornecedoresRepo.create({ razao_social: "X" } as any);
    expect(recorded[0].table).toBe("fornecedores");
    expect(recorded[0].ops[0]).toEqual({
      op: "insert",
      args: [{ razao_social: "X" }],
    });
  });

  it("update() aplica patch por id", async () => {
    await fornecedoresRepo.update("f1", { ativo: false } as any);
    expect(recorded[0].ops).toEqual([
      { op: "update", args: [{ ativo: false }] },
      { op: "eq", args: ["id", "f1"] },
    ]);
  });

  it("update() propaga erro", async () => {
    reset({ data: null, error: new Error("u") });
    await expect(fornecedoresRepo.update("f", {} as any)).rejects.toThrow("u");
  });
});
