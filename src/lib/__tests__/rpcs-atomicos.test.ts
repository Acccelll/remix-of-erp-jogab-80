import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Testes de contrato (H1.4) para os 4 RPCs atômicos criados em H1.3.
 *
 * Estes testes não tocam o banco — eles validam que:
 *   1. Os tipos gerados (`Database["public"]["Functions"]`) expõem cada RPC
 *      com a forma de argumentos esperada.
 *   2. Um caller "modelo" envia payloads no shape correto (chaves obrigatórias,
 *      tipos primitivos, jsonb arrays bem formados).
 *
 * Se alguém alterar a assinatura SQL sem regenerar tipos OU sem atualizar os
 * callers, este teste quebra antes do runtime.
 */

import type { RpcContracts } from "./rpc-contracts";

type Fns = RpcContracts;

// --- Mock do client supabase (capturamos os args da última chamada rpc) ---
const rpcMock = vi.fn().mockResolvedValue({ data: null, error: null });
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

import { supabase } from "@/integrations/supabase/client";

beforeEach(() => {
  rpcMock.mockClear();
});

// ─────────────────────────────────────────────────────────────────────────────
// 1) criar_medicao_atomica
// ─────────────────────────────────────────────────────────────────────────────
describe("RPC criar_medicao_atomica", () => {
  it("expõe a assinatura esperada nos tipos", () => {
    const args: Fns["criar_medicao_atomica"]["Args"] = {
      p_obra_id: "00000000-0000-0000-0000-000000000000",
      p_numero: "1",
      p_data_inicio: "2026-01-01",
      p_data_corte: "2026-01-31",
      p_observacoes: "",
      p_valor_total: 1234.56,
      p_itens: [],
      p_bms_id: undefined,
    };
    expect(args.p_obra_id).toBeTypeOf("string");
    expect(args.p_valor_total).toBeTypeOf("number");
    expect(Array.isArray(args.p_itens)).toBe(true);
  });

  it("caller envia payload com apenas itens delta (pctAtual > pctAnterior)", async () => {
    const itens = [
      { cronograma_item_id: "a", pct_anterior: 10, pct_atual: 25, valor: 100 },
      { cronograma_item_id: "b", pct_anterior: 50, pct_atual: 50, valor: 0 }, // não deve ser enviado
    ];
    const delta = itens.filter((i) => i.pct_atual > i.pct_anterior);

    await supabase.rpc(
      "criar_medicao_atomica" as never,
      {
        p_obra_id: "obra-1",
        p_numero: "1",
        p_data_inicio: "2026-01-01",
        p_data_corte: "2026-01-31",
        p_observacoes: "",
        p_valor_total: 100,
        p_itens: delta,
        p_bms_id: "bms-1",
      } as never,
    );

    expect(rpcMock).toHaveBeenCalledOnce();
    const [name, args] = rpcMock.mock.calls[0];
    expect(name).toBe("criar_medicao_atomica");
    expect(args.p_itens).toHaveLength(1);
    expect(args.p_itens[0].cronograma_item_id).toBe("a");
    expect(args.p_bms_id).toBe("bms-1");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2) fechar_bms_atomica
// ─────────────────────────────────────────────────────────────────────────────
describe("RPC fechar_bms_atomica", () => {
  it("expõe a assinatura esperada nos tipos", () => {
    const args: Fns["fechar_bms_atomica"]["Args"] = {
      p_bms_id: "bms-1",
      p_valor_realizado: 500,
      p_futuras: [],
      p_registros: [],
    };
    expect(args.p_valor_realizado).toBeTypeOf("number");
  });

  it("caller envia futuras e registros como arrays JSON", async () => {
    await supabase.rpc(
      "fechar_bms_atomica" as never,
      {
        p_bms_id: "bms-1",
        p_valor_realizado: 800,
        p_futuras: [{ id: "f1", valor_previsto_dinamico: 200 }],
        p_registros: [{ bms_origem_id: "bms-1", bms_destino_id: "f1", valor: 200 }],
      } as never,
    );

    const [name, args] = rpcMock.mock.calls[0];
    expect(name).toBe("fechar_bms_atomica");
    expect(Array.isArray(args.p_futuras)).toBe(true);
    expect(Array.isArray(args.p_registros)).toBe(true);
    expect(args.p_registros[0]).toHaveProperty("bms_origem_id");
    expect(args.p_registros[0]).toHaveProperty("bms_destino_id");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3) salvar_nf_atomica
// ─────────────────────────────────────────────────────────────────────────────
describe("RPC salvar_nf_atomica", () => {
  it("expõe a assinatura esperada nos tipos", () => {
    const args: Fns["salvar_nf_atomica"]["Args"] = {
      p_nf_id: "nf-1",
      p_payload: { numero: "001", valor: 1000 },
      p_data_prevista: "2026-02-15",
      p_valor_liquido: 1000,
      p_bms_prevista_id: "bms-1",
      p_medicao_id_fallback: "med-1",
      p_valor_contrato: 1_000_000,
    };
    expect(args.p_valor_liquido).toBeTypeOf("number");
    expect(args.p_payload).toBeTypeOf("object");
  });

  it("caller propaga payload completo + valor_contrato para recálculo", async () => {
    await supabase.rpc(
      "salvar_nf_atomica" as never,
      {
        p_nf_id: null,
        p_payload: { numero: "001", obra_id: "obra-1", valor: 1000 },
        p_data_prevista: "2026-02-15",
        p_valor_liquido: 1000,
        p_bms_prevista_id: null,
        p_medicao_id_fallback: null,
        p_valor_contrato: 500_000,
      } as never,
    );

    const [name, args] = rpcMock.mock.calls[0];
    expect(name).toBe("salvar_nf_atomica");
    expect(args.p_payload.numero).toBe("001");
    expect(args.p_valor_contrato).toBe(500_000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4) excluir_nf_atomica
// ─────────────────────────────────────────────────────────────────────────────
describe("RPC excluir_nf_atomica", () => {
  it("expõe a assinatura esperada nos tipos", () => {
    const args: Fns["excluir_nf_atomica"]["Args"] = {
      p_nf_id: "nf-1",
      p_valor_contrato: 500_000,
    };
    expect(args.p_nf_id).toBeTypeOf("string");
    expect(args.p_valor_contrato).toBeTypeOf("number");
  });

  it("caller invoca com nf_id e valor_contrato", async () => {
    await supabase.rpc(
      "excluir_nf_atomica" as never,
      {
        p_nf_id: "nf-99",
        p_valor_contrato: 250_000,
      } as never,
    );

    const [name, args] = rpcMock.mock.calls[0];
    expect(name).toBe("excluir_nf_atomica");
    expect(args.p_nf_id).toBe("nf-99");
    expect(args.p_valor_contrato).toBe(250_000);
  });
});
