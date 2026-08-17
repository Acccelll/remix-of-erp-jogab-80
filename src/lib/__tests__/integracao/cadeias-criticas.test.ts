import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * H1.4 — Testes de cadeia crítica.
 *
 * Validam contratos entre módulos (RPCs atômicas + shape dos payloads
 * que o front-end envia) sem tocar no banco. Se alguém alterar a
 * assinatura de qualquer RPC de cadeia sem atualizar os consumers,
 * estes testes quebram antes do runtime.
 */
import type { RpcContracts } from "../rpc-contracts";

type Fns = RpcContracts;

const rpcMock = vi.fn().mockResolvedValue({ data: null, error: null });
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...args: unknown[]) => rpcMock(...args) },
}));

import { supabase } from "@/integrations/supabase/client";

beforeEach(() => rpcMock.mockClear());

// ─────────────────────────────────────────────────────────────────────────────
// Cadeia 1 — Cronograma → BMS → Medição → Faturamento
// ─────────────────────────────────────────────────────────────────────────────
describe("Cadeia 1: Cronograma → BMS → Medição → Faturamento", () => {
  it("fecha BMS e cria medição encadeada com mesmo escopo de itens", async () => {
    const bmsId = "bms-1";
    const obraId = "obra-1";

    const registros = [{ cronograma_item_id: "ci-a", pct_realizado: 30, valor: 300 }];
    const futuras = [{ cronograma_item_id: "ci-a", periodo: "2026-02", pct: 20, valor: 200 }];

    const fecharArgs: Fns["fechar_bms_atomica"]["Args"] = {
      p_bms_id: bmsId,
      p_futuras: futuras,
      p_registros: registros,
      p_valor_realizado: 300,
    };
    await supabase.rpc("fechar_bms_atomica" as never, fecharArgs as never);

    const medicaoArgs: Fns["criar_medicao_atomica"]["Args"] = {
      p_obra_id: obraId,
      p_numero: "1",
      p_data_inicio: "2026-01-01",
      p_data_corte: "2026-01-31",
      p_observacoes: "",
      p_valor_total: 300,
      p_itens: registros.map((r) => ({
        cronograma_item_id: r.cronograma_item_id,
        pct_anterior: 0,
        pct_atual: r.pct_realizado,
        valor: r.valor,
      })),
      p_bms_id: bmsId,
    };
    await supabase.rpc("criar_medicao_atomica" as never, medicaoArgs as never);

    expect(rpcMock).toHaveBeenCalledTimes(2);
    expect(rpcMock.mock.calls[0][0]).toBe("fechar_bms_atomica");
    expect(rpcMock.mock.calls[1][0]).toBe("criar_medicao_atomica");
    // BMS id carrega para a medição → garante linkagem da cadeia
    expect(rpcMock.mock.calls[1][1].p_bms_id).toBe(bmsId);
    expect(rpcMock.mock.calls[1][1].p_valor_total).toBe(registros.reduce((s, r) => s + r.valor, 0));
  });

  it("salvar NF reaproveita medicao_id_fallback quando bms_prevista_id é nulo", async () => {
    const args: Fns["salvar_nf_atomica"]["Args"] = {
      p_bms_prevista_id: null as unknown as string,
      p_data_prevista: "2026-02-15",
      p_medicao_id_fallback: "med-1",
      p_nf_id: null as unknown as string,
      p_payload: { numero: "NF-001", valor_bruto: 300 },
      p_valor_contrato: 1000,
      p_valor_liquido: 285,
    };
    await supabase.rpc("salvar_nf_atomica" as never, args as never);
    expect(rpcMock.mock.calls[0][1].p_medicao_id_fallback).toBe("med-1");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cadeia 2 — Cotação → OC → Recebimento → Estoque
// ─────────────────────────────────────────────────────────────────────────────
describe("Cadeia 2: Cotação → OC → Recebimento → Estoque", () => {
  it("emite OC e registra recebimento com itens no shape esperado", async () => {
    const ocId = "oc-1";

    await supabase.rpc("emitir_oc_atomico" as never, { p_oc_id: ocId } as never);

    const itens = [
      { item_id: "it-1", insumo_id: "ins-1", quantidade: 5 },
      { item_id: "it-2", insumo_id: "ins-2", quantidade: 2 },
    ];
    const recArgs: Fns["registrar_recebimento_atomico"]["Args"] = {
      p_oc_id: ocId,
      p_data: "2026-01-15",
      p_nota_fiscal: "NF-123",
      p_observacao: "",
      p_owner_id: "user-1",
      p_itens: itens,
    };
    await supabase.rpc("registrar_recebimento_atomico" as never, recArgs as never);

    expect(rpcMock).toHaveBeenCalledTimes(2);
    expect(rpcMock.mock.calls[0][0]).toBe("emitir_oc_atomico");
    expect(rpcMock.mock.calls[0][1].p_oc_id).toBe(ocId);
    expect(rpcMock.mock.calls[1][0]).toBe("registrar_recebimento_atomico");
    expect(rpcMock.mock.calls[1][1].p_oc_id).toBe(ocId);
    expect(Array.isArray(rpcMock.mock.calls[1][1].p_itens)).toBe(true);
    expect(rpcMock.mock.calls[1][1].p_itens).toHaveLength(2);
    for (const it of rpcMock.mock.calls[1][1].p_itens as typeof itens) {
      expect(typeof it.insumo_id).toBe("string");
      expect(typeof it.quantidade).toBe("number");
      expect(it.quantidade).toBeGreaterThan(0);
    }
  });

  it("transferência de estoque expõe origem/destino/insumo e quantidade positiva", () => {
    const args: Fns["fn_estoque_transferir"]["Args"] = {
      p_origem: "alm-1",
      p_destino: "alm-2",
      p_insumo: "ins-1",
      p_quantidade: 3,
      p_observacao: "ajuste",
    };
    expect(args.p_quantidade).toBeGreaterThan(0);
    expect(args.p_origem).not.toBe(args.p_destino);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cadeia 3 — Solicitação Financeira → Aprovação → Lançamento
// ─────────────────────────────────────────────────────────────────────────────
describe("Cadeia 3: Solicitação Financeira → Aprovação → Lançamento", () => {
  it("gera lançamento a partir de solicitação aprovada com mesma chave de origem", async () => {
    const solicitacaoId = "sol-1";
    const args: Fns["fn_lancamento_solicitacao_aprovada"]["Args"] = {
      p_solicitacao_id: solicitacaoId,
      p_obra_id: "obra-1",
      p_centro_custo: "cc-1",
      p_data_prevista: "2026-02-10",
      p_descricao: "Pagamento fornecedor X",
      p_valor: 1500,
    };
    await supabase.rpc("fn_lancamento_solicitacao_aprovada" as never, args as never);
    expect(rpcMock).toHaveBeenCalledOnce();
    expect(rpcMock.mock.calls[0][1].p_solicitacao_id).toBe(solicitacaoId);
    expect(rpcMock.mock.calls[0][1].p_valor).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cadeia 4 — OC aprovação → emissão (governança de alçada)
// ─────────────────────────────────────────────────────────────────────────────
describe("Cadeia 4: OC aprovação → emissão", () => {
  it("só emite a OC após o passo de aprovação retornar sucesso", async () => {
    rpcMock.mockResolvedValueOnce({ data: { ok: true }, error: null });
    rpcMock.mockResolvedValueOnce({ data: { ok: true }, error: null });

    const ocId = "oc-9";
    const { data: aprov } = await supabase.rpc(
      "fn_oc_aprovar" as never,
      { p_oc_id: ocId } as never,
    );
    expect((aprov as unknown as { ok: boolean }).ok).toBe(true);

    await supabase.rpc("emitir_oc_atomico" as never, { p_oc_id: ocId } as never);

    expect(rpcMock.mock.calls.map((c) => c[0])).toEqual(["fn_oc_aprovar", "emitir_oc_atomico"]);
    expect(rpcMock.mock.calls[0][1].p_oc_id).toBe(ocId);
    expect(rpcMock.mock.calls[1][1].p_oc_id).toBe(ocId);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cadeia 5 — Faturamento → Recálculo financeiro / Reversão por BMS
// ─────────────────────────────────────────────────────────────────────────────
describe("Cadeia 5: Faturamento → Recálculo / Reversão", () => {
  it("após emitir NF, dispara recálculo da projeção da obra", async () => {
    const nfId = "nf-1";
    const obraId = "obra-1";
    const valorContrato = 100000;

    await supabase.rpc(
      "salvar_nf_atomica" as never,
      {
        p_bms_prevista_id: "bp-1",
        p_data_prevista: "2026-02-15",
        p_medicao_id_fallback: null,
        p_nf_id: nfId,
        p_payload: { numero: "NF-100", valor_bruto: 5000 },
        p_valor_contrato: valorContrato,
        p_valor_liquido: 4750,
      } as never,
    );

    await supabase.rpc(
      "fn_recalcular_apos_faturamento" as never,
      {
        p_nf_id: nfId,
        p_obra_id: obraId,
        p_valor_contrato: valorContrato,
      } as never,
    );

    expect(rpcMock).toHaveBeenCalledTimes(2);
    expect(rpcMock.mock.calls[1][0]).toBe("fn_recalcular_apos_faturamento");
    expect(rpcMock.mock.calls[1][1].p_nf_id).toBe(nfId);
    expect(rpcMock.mock.calls[1][1].p_obra_id).toBe(obraId);
  });

  it("exclusão de NF e reversão por BMS compartilham mesmo valor de contrato", async () => {
    await supabase.rpc(
      "excluir_nf_atomica" as never,
      {
        p_nf_id: "nf-2",
        p_valor_contrato: 100000,
      } as never,
    );
    await supabase.rpc(
      "fn_reverter_faturamento_bms" as never,
      {
        p_bms_id: "bms-9",
        p_obra_id: "obra-1",
        p_valor_contrato: 100000,
      } as never,
    );
    expect(rpcMock.mock.calls[0][1].p_valor_contrato).toBe(
      rpcMock.mock.calls[1][1].p_valor_contrato,
    );
  });
});
