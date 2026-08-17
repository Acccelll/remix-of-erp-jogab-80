/**
 * Testes de contrato do romaneiosRepo — mock do cliente `supabase`, sem banco.
 * Mesmo padrão de src/lib/__tests__/integracao/repositories-contrato.test.ts,
 * estendido com `.rpc()` para cobrir a leg de confirmação de estoque.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

type Recorded = { table: string; ops: Array<{ op: string; args: unknown[] }> };

const recorded: Recorded[] = [];
const rpcCalls: Array<{ fn: string; args: unknown }> = [];
let nextResult: { data: unknown; error: unknown } = { data: [], error: null };
let nextRpcResult: { data: unknown; error: unknown } = { data: { ok: true }, error: null };

function chain(rec: Recorded) {
  const thenable: any = {
    then(onOk: (v: unknown) => unknown, onErr?: (e: unknown) => unknown) {
      return Promise.resolve(nextResult).then(onOk, onErr);
    },
  };
  const ops = ["select", "insert", "update", "delete", "eq", "or", "order", "limit", "single"];
  for (const op of ops) {
    thenable[op] = (...args: unknown[]) => {
      rec.ops.push({ op, args });
      return thenable;
    };
  }
  return thenable;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from(table: string) {
      const rec: Recorded = { table, ops: [] };
      recorded.push(rec);
      return chain(rec);
    },
    rpc(fn: string, args: unknown) {
      rpcCalls.push({ fn, args });
      return Promise.resolve(nextRpcResult);
    },
  },
}));

function reset(result: { data: unknown; error: unknown } = { data: [], error: null }) {
  recorded.length = 0;
  rpcCalls.length = 0;
  nextResult = result;
  nextRpcResult = { data: { ok: true }, error: null };
}

import { romaneiosRepo } from "@/lib/repositories/romaneios";

describe("romaneiosRepo — contrato de query", () => {
  beforeEach(() => reset());

  it("listResumo() sem filtro apenas ordena por created_at", async () => {
    reset({ data: [], error: null });
    await romaneiosRepo.listResumo();
    const rec = recorded[0];
    expect(rec.table).toBe("romaneios");
    expect(rec.ops.some((o) => o.op === "order")).toBe(true);
    expect(rec.ops.some((o) => o.op === "eq")).toBe(false);
  });

  it("listResumo({status}) filtra por eq(status)", async () => {
    reset({ data: [], error: null });
    await romaneiosRepo.listResumo({ status: "rascunho" });
    const rec = recorded[0];
    const eqOp = rec.ops.find((o) => o.op === "eq");
    expect(eqOp?.args).toEqual(["status", "rascunho"]);
  });

  it("create() insere com numero gerado e retorna o id", async () => {
    reset({ data: { id: "abc-123" }, error: null });
    const id = await romaneiosRepo.create({
      numero: "RM-2026-000001",
      obraOrigemId: null,
      obraDestinoId: "obra-1",
    });
    expect(id).toBe("abc-123");
    const rec = recorded[0];
    expect(rec.table).toBe("romaneios");
    const insertOp = rec.ops.find((o) => o.op === "insert");
    expect((insertOp?.args[0] as any).numero).toBe("RM-2026-000001");
    expect((insertOp?.args[0] as any).obra_destino_id).toBe("obra-1");
  });

  it("confirmarEstoque() chama o RPC fn_romaneio_confirmar_estoque com o id", async () => {
    reset();
    nextRpcResult = { data: { ok: true, itens_baixados: 2 }, error: null };
    const result = await romaneiosRepo.confirmarEstoque("rom-1");
    expect(result).toEqual({ ok: true, itens_baixados: 2 });
    expect(rpcCalls[0].fn).toBe("fn_romaneio_confirmar_estoque");
    expect(rpcCalls[0].args).toEqual({ p_romaneio_id: "rom-1" });
  });

  it("confirmarEstoque() propaga erro do RPC (ex.: saldo insuficiente)", async () => {
    reset();
    nextRpcResult = { data: null, error: new Error("Saldo insuficiente no local de origem") };
    await expect(romaneiosRepo.confirmarEstoque("rom-1")).rejects.toThrow("Saldo insuficiente");
  });

  it("addItemPatrimonio() insere com romaneio_id e patrimonio_id", async () => {
    reset({ data: null, error: null });
    await romaneiosRepo.addItemPatrimonio("rom-1", {
      patrimonioId: "pat-9",
      patrimonioNome: "Gerador",
    });
    const rec = recorded[0];
    expect(rec.table).toBe("romaneio_itens_patrimonio");
    const insertOp = rec.ops.find((o) => o.op === "insert");
    expect((insertOp?.args[0] as any).romaneio_id).toBe("rom-1");
    expect((insertOp?.args[0] as any).patrimonio_id).toBe("pat-9");
  });

  it("marcarItemPatrimonioMobilizado(false) grava mobilizacao_erro", async () => {
    reset({ data: null, error: null });
    await romaneiosRepo.marcarItemPatrimonioMobilizado("item-1", false, "timeout");
    const rec = recorded[0];
    const updateOp = rec.ops.find((o) => o.op === "update");
    expect((updateOp?.args[0] as any).mobilizado).toBe(false);
    expect((updateOp?.args[0] as any).mobilizacao_erro).toBe("timeout");
  });

  it("setStatusFinal() propaga erro quando a escrita falha", async () => {
    reset({ data: null, error: new Error("denied") });
    await expect(romaneiosRepo.setStatusFinal("rom-1", "confirmado")).rejects.toThrow("denied");
  });
});
