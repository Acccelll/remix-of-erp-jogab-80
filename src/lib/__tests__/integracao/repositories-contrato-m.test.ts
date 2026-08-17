/**
 * TST-002 (lote M) — Contrato de `obrasRepo`. Última fatia estruturante
 * antes da revisão do NO-GO da Onda 6.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

import { recorded, reset } from "./_duplo-supabase";

vi.mock("@/integrations/supabase/client", async () => {
  const { supabaseFalso } = await import("./_duplo-supabase");
  return { supabase: supabaseFalso };
});

import { obrasRepo } from "@/lib/repositories/obras";

describe("TST-002.m · obrasRepo — projeções de resumo", () => {
  beforeEach(() => reset());

  // listResumo/listResumoComCodigo/listResumoComCodigoNome removidos em ARC-010.slice-07.
  // Fonte única de obras em runtime: `useObras()` (`@/hooks/useObras`).

  it("listComClienteId() inclui cliente_id e ordena codigo", async () => {
    await obrasRepo.listComClienteId();
    expect(recorded[0].ops[0].args[0]).toBe("id, codigo, nome, cliente_id");
    expect(recorded[0].ops[1].args).toEqual(["codigo"]);
  });

  it("listMinContrato() inclui valor_contrato e ordena codigo", async () => {
    await obrasRepo.listMinContrato();
    expect(recorded[0].ops[0].args[0]).toBe("id, codigo, nome, valor_contrato");
  });

  it("listComCodigoTotvs() aplica limit 2000 sem ordenação", async () => {
    await obrasRepo.listComCodigoTotvs();
    expect(recorded[0].ops).toEqual([
      { op: "select", args: ["id, nome, codigo, codigo_totvs"] },
      { op: "limit", args: [2000] },
    ]);
  });

  it("listDashboard() usa colunas fixas de dashboard", async () => {
    await obrasRepo.listDashboard();
    expect(recorded[0].ops[0].args[0]).toBe(
      "id, codigo, nome, valor_contrato, status, data_previsao_termino, data_fim, prazo_emitir_nf_dias, centro_custo_totvs",
    );
  });

  it("listComCliente() usa join clientes(nome) + valores TOTVS e ordena codigo", async () => {
    await obrasRepo.listComCliente();
    const [selectOp, ...resto] = recorded[0].ops;
    expect(selectOp.op).toBe("select");
    const cols = String(selectOp.args[0]);
    expect(cols).toContain("clientes(nome)");
    // Valores de faturamento/recebimento vêm da view consolidada da TOTVS.
    expect(cols).toContain("obra_valores:vw_obra_valores(");
    expect(cols).toContain("receita_baixada");
    expect(resto).toEqual([
      { op: "order", args: ["codigo"] },
      { op: "limit", args: [expect.any(Number)] },
    ]);
  });
});

describe("TST-002.m · obrasRepo — leituras por id", () => {
  beforeEach(() => reset());

  it("getCentroCustoTotvs() usa maybeSingle e devolve string ou null", async () => {
    reset({ data: { centro_custo_totvs: "CC-1" }, error: null });
    expect(await obrasRepo.getCentroCustoTotvs("o1")).toBe("CC-1");
    const rec = recorded[0];
    expect(rec.ops.map((o) => o.op)).toEqual(["select", "eq", "maybeSingle"]);
    expect(rec.ops[0].args[0]).toBe("centro_custo_totvs");
    expect(rec.ops[1].args).toEqual(["id", "o1"]);

    reset({ data: null, error: null });
    expect(await obrasRepo.getCentroCustoTotvs("o1")).toBeNull();

    reset({ data: { centro_custo_totvs: null }, error: null });
    expect(await obrasRepo.getCentroCustoTotvs("o1")).toBeNull();
  });

  it("getCentroCustoTotvs() propaga erro", async () => {
    reset({ data: null, error: new Error("cc") });
    await expect(obrasRepo.getCentroCustoTotvs("o1")).rejects.toThrow("cc");
  });

  it("getNome() usa maybeSingle e devolve nome ou null", async () => {
    reset({ data: { nome: "Obra X" }, error: null });
    expect(await obrasRepo.getNome("o1")).toBe("Obra X");
    expect(recorded[0].ops[0].args[0]).toBe("nome");

    reset({ data: null, error: null });
    expect(await obrasRepo.getNome("o1")).toBeNull();
  });

  it("getPedidoValorContrato() devolve payload cru ou null", async () => {
    reset({
      data: { pedido_contrato: "PED-1", valor_contrato: 1000 },
      error: null,
    });
    expect(await obrasRepo.getPedidoValorContrato("o1")).toEqual({
      pedido_contrato: "PED-1",
      valor_contrato: 1000,
    });
    expect(recorded[0].ops[0].args[0]).toBe("pedido_contrato, valor_contrato");
    expect(recorded[0].ops.map((o) => o.op)).toEqual(["select", "eq", "maybeSingle"]);

    reset({ data: null, error: null });
    expect(await obrasRepo.getPedidoValorContrato("o1")).toBeNull();

    reset({ data: null, error: new Error("v") });
    await expect(obrasRepo.getPedidoValorContrato("o1")).rejects.toThrow("v");
  });

  it("getById() usa join clientes(nome, cnpj), limit(1) e devolve primeiro registro", async () => {
    reset({
      data: [{ id: "o1", clientes: { nome: "C", cnpj: "1" } }],
      error: null,
    });
    const out = await obrasRepo.getById("o1");
    expect(out).toEqual({ id: "o1", clientes: { nome: "C", cnpj: "1" } });
    const rec = recorded[0];
    expect(rec.ops.map((o) => o.op)).toEqual(["select", "eq", "limit"]);
    expect(rec.ops[0].args[0]).toBe("*, clientes(nome, cnpj)");
    expect(rec.ops[1].args).toEqual(["id", "o1"]);
    expect(rec.ops[2].args).toEqual([1]);
  });

  it("getById() devolve null para data vazia/null e propaga erro", async () => {
    reset({ data: [], error: null });
    expect(await obrasRepo.getById("o1")).toBeNull();

    reset({ data: null, error: null });
    expect(await obrasRepo.getById("o1")).toBeNull();

    reset({ data: null, error: new Error("g") });
    await expect(obrasRepo.getById("o1")).rejects.toThrow("g");
  });
});

describe("TST-002.m · obrasRepo — mutações", () => {
  beforeEach(() => reset());

  it("create() faz insert simples e propaga erro", async () => {
    await obrasRepo.create({ nome: "N" } as any);
    expect(recorded[0].table).toBe("obras");
    expect(recorded[0].ops[0]).toEqual({ op: "insert", args: [{ nome: "N" }] });

    reset({ data: null, error: new Error("i") });
    await expect(obrasRepo.create({} as any)).rejects.toThrow("i");
  });

  it("update() aplica patch por id e propaga erro", async () => {
    await obrasRepo.update("o1", { nome: "X" } as any);
    expect(recorded[0].ops).toEqual([
      { op: "update", args: [{ nome: "X" }] },
      { op: "eq", args: ["id", "o1"] },
    ]);

    reset({ data: null, error: new Error("u") });
    await expect(obrasRepo.update("o1", {} as any)).rejects.toThrow("u");
  });

  it("remove() delete por id e propaga erro", async () => {
    await obrasRepo.remove("o1");
    expect(recorded[0].ops).toEqual([
      { op: "delete", args: [] },
      { op: "eq", args: ["id", "o1"] },
    ]);

    reset({ data: null, error: new Error("d") });
    await expect(obrasRepo.remove("o1")).rejects.toThrow("d");
  });
});
