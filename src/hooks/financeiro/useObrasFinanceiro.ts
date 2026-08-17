// React Query hooks para o módulo Financeiro (Obras, Dashboard, Financeiro, Fluxo)
// Converte os loaders/server-fns do flowcast em hooks client-side.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKey } from "@/lib/query-keys";
import { obrasRepo } from "@/lib/repositories/obras";
export { useClientes } from "@/hooks/crm/useClientes";
import {
  financeiroRepo,
  centrosCustoTotvsRepo,
} from "@/lib/repositories/financeiro";

// ─── Chaves de query ───────────────────────────────────────────────
export const finKeys = {
  obras: queryKey("fin_obras"),
  obra: (id: string) => queryKey("fin_obra", id),
  clientes: queryKey("fin_clientes"),
  centros: queryKey("fin_centros_custo_totvs"),
  dashboard: queryKey("fin_dashboard"),
  lancamentos: (filtros?: Record<string, unknown>) =>
    filtros ? queryKey("fin_lancamentos", filtros) : queryKey("fin_lancamentos"),
  snapshots: queryKey("fin_snapshots"),
  fluxo: (obraId?: string) => queryKey("fin_fluxo", obraId),
  acFolha: (obraId: string) => queryKey("fin_ac_folha", obraId),
};

// Colunas explícitas de `obras` (Fase 1 #10 — evita `select("*")`).
const OBRAS_COLS =
  "id, nome, codigo, codigo_totvs, centro_custo_totvs, cliente, cliente_id, " +
  "valor_contrato, percentual_antecipacao, valor_antecipacao, " +
  "data_inicio, data_fim, data_mobilizacao, data_desmobilizacao, data_previsao_termino, " +
  "regra_medicao, prazo_emitir_nf_dias, prazo_pagamento_dias, dia_fixo_pagamento, " +
  "status, ativa, requer_integracao, integracao_info, local, pedido_contrato, " +
  "cnpj, prazo_padrao_pagamento, dia_fixo_pagamento_1, dia_fixo_pagamento_2, " +
  "data_corte_medicao_1, data_corte_medicao_2, flowcast_id, created_at, " +
  "percentual_material, observacoes";

const SNAPSHOTS_COLS =
  "id, importado_em, periodo_ref, nome_arquivo_titulos, nome_arquivo_rateios, " +
  "total_titulos, total_rateios, total_valor, titulos_sem_obra, owner_id, " +
  "novos_sem_natureza, matriz_atualizada_em";

// Colunas explícitas dos embeds de `useObraFinanceiro` (Fase 1 #10 — evita `select("*")`).
const CRONO_ITENS_COLS =
  "id, obra_id, ordem, descricao, uid_mpp, data_inicio, data_fim, data_inicio_baseline, data_fim_baseline, percentual_previsto, percentual_realizado, custo, custo_baseline, ativo, folga_dias, critico, folga_livre_dias, fanout_sucessoras, importancia_score, importancia_classe, calendario_uid_mpp, recursos_count, recursos_status, localizacao_id, servico_lob";
const MEDICOES_COLS =
  "id, obra_id, numero, data_corte, data_aprovacao, valor, percentual, status, observacoes, arquivo_origem, sheet_origem, data_inicio, baseline_id";
const NFS_COLS =
  "id, obra_id, medicao_id, numero, data_emissao, valor, valor_liquido, valor_servicos, data_vencimento, status, pdf_url, observacoes, percentual_material, valor_material, inss_retido, iss_retido, outras_retencoes, retencao_cbs, retencao_ibs, codigo_cno, codigo_art, competencia, codigo_verificacao";
const RECEB_COLS =
  "id, obra_id, nota_fiscal_id, cronograma_item_id, data_prevista, data_recebimento, valor_previsto, valor_previsto_inicial, valor_recebido, status, congelado, origem, observacoes";
const BMS_PREV_COLS =
  "id, obra_id, numero, data_inicio_janela, data_corte, valor_previsto_inicial, valor_previsto_dinamico, valor_previsto_dinamico_pre_faturamento, data_emissao_nfs_prevista, data_pagamento_prevista, status, medicao_id, nota_fiscal_id, observacoes, origem, editado_em, valor_realizado";
const ADITIVOS_COLS =
  "id, obra_id, numero, tipo, valor_financeiro, dias_prazo, data_aprovacao, documento_url, observacoes, status, baseline_id, contrato_id";
const RISCOS_COLS =
  "id, obra_id, codigo, descricao, categoria, tipo, probabilidade, impacto, impacto_financeiro, status, responsavel, resposta, plano_resposta, observacoes, data_revisao, card_id, data_identificacao";
const OCORRENCIAS_COLS =
  "id, obra_id, titulo, descricao, prioridade, status, responsavel, risco_id, data_abertura, data_resolucao, acao_corretiva";
const LICOES_COLS =
  "id, obra_id, categoria, situacao, recomendacao, impacto, risco_id, card_id, responsavel, tags, data_registro";

// ─── Obras ─────────────────────────────────────────────────────────
export function useObrasFinanceiro() {
  return useQuery({
    queryKey: finKeys.obras,
    queryFn: () => obrasRepo.selectOrdered(`${OBRAS_COLS}, clientes(nome)`, "codigo"),
  });
}

export function useObraFinanceiro(id: string) {
  return useQuery({
    queryKey: finKeys.obra(id),
    queryFn: () =>
      obrasRepo.selectByIdMaybeSingle(
        `
        ${OBRAS_COLS},
        clientes(id, nome, cnpj, prazo_pagamento_dias),
        cronograma_itens(${CRONO_ITENS_COLS}),
        medicoes(${MEDICOES_COLS}),
        notas_fiscais(${NFS_COLS}),
        recebimentos(${RECEB_COLS}),
        bms_previstas(${BMS_PREV_COLS}),
        aditivos_contrato(${ADITIVOS_COLS}),
        riscos(${RISCOS_COLS}),
        ocorrencias(${OCORRENCIAS_COLS}),
        licoes_aprendidas(${LICOES_COLS})
      `,
        id,
      ),
    enabled: !!id,
  });
}

// ─── Clientes ──────────────────────────────────────────────────────
// `useClientes` re-exportado do hook canônico em `@/hooks/useClientes` (topo do arquivo).
// `finKeys.clientes` fica para retrocompat de invalidações eventuais.


// ─── Centros de custo TOTVS ────────────────────────────────────────
const CENTROS_CUSTO_COLS =
  "id, codigo, descricao, tipo, categoria, obra_id, ativo, owner_id, created_at, updated_at, obras(id, nome, codigo)";
export function useCentrosCustoTotvs() {
  return useQuery({
    queryKey: finKeys.centros,
    queryFn: () => centrosCustoTotvsRepo.selectOrdered(CENTROS_CUSTO_COLS, "codigo"),
  });
}

// ─── Dashboard ─────────────────────────────────────────────────────
export function useDashboard() {
  return useQuery({
    queryKey: finKeys.dashboard,
    queryFn: async () => {
      const [obras, recebimentos, nfs, medicoes, bms, crono, fin] = await Promise.all([
        obrasRepo.selectAll(
          "id, codigo, nome, valor_contrato, status, data_previsao_termino, data_fim, centro_custo_totvs, ativa",
        ),
        financeiroRepo.listRecebimentosDashboard(),
        financeiroRepo.listNfsDashboard(),
        financeiroRepo.listMedicoesDashboard(),
        financeiroRepo.listBmsPrevistasDashboard(),
        financeiroRepo.listCronogramaItensDashboard(),
        financeiroRepo.listVwFinanceiroObra(
          "obra_id, grupo, valor_rateio, mes_competencia, status_cod",
        ),
      ]);
      return { obras, recebimentos, nfs, medicoes, bms, crono, fin };
    },
  });
}

// Colunas explícitas da view — evita `select("*")` (Fase 1 #10 do plano).
const VW_FIN_OBRA_COLS =
  "lancamento_id, obra_id, obra_nome, obra_codigo, centro_custo, desc_centro_custo, " +
  "ref_lancamento, natureza_tipo, status_cod, status_label, contraparte, cliente_fornecedor, " +
  "valor_liquido, valor_baixado, data_emissao, data_vencimento, data_pagamento, " +
  "mes_competencia, origem, cod_natureza, desc_natureza, grupo, subgrupo, valor_rateio, " +
  "status_lancamento, centro_custo_tipo, categoria_indireta";

// ─── Financeiro: Lançamentos ───────────────────────────────────────
export function useLancamentos(filtros?: { obraId?: string; origem?: "totvs" | "sistema" }) {
  return useQuery({
    queryKey: finKeys.lancamentos(filtros),
    queryFn: () => financeiroRepo.listVwFinanceiroObra(VW_FIN_OBRA_COLS, filtros),
  });
}

// ─── Snapshots financeiros ─────────────────────────────────────────
export function useSnapshots() {
  return useQuery({
    queryKey: finKeys.snapshots,
    queryFn: () => financeiroRepo.listSnapshotsImportados(SNAPSHOTS_COLS),
  });
}

// ─── AC da Folha por obra (Decisão 1) ─────────────────────────────
export function useAcFolhaPorObra(obraId: string) {
  return useQuery({
    queryKey: finKeys.acFolha(obraId),
    queryFn: async () => {
      const codigo = await financeiroRepo.getCentroCodigoObra(obraId);
      if (!codigo) return [];
      return financeiroRepo.listAcFolhaByCentro(codigo);
    },
    enabled: !!obraId,
  });
}

// ─── Mutation: importar snapshot TOTVS ────────────────────────────
export function useImportarSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      periodoRef: string;
      nomeTitulos: string;
      nomeRateios: string;
      lancamentos: unknown[];
      rateios: unknown[];
    }) =>
      financeiroRepo.importarSnapshot({
        p_periodo_ref: args.periodoRef,
        p_nome_titulos: args.nomeTitulos,
        p_nome_rateios: args.nomeRateios,
        p_lancamentos: args.lancamentos as any,
        p_rateios: args.rateios as any,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: finKeys.snapshots });
      qc.invalidateQueries({ queryKey: finKeys.lancamentos() });
      qc.invalidateQueries({ queryKey: finKeys.dashboard });
      toast.success("Snapshot importado com sucesso");
    },
    onError: (err: Error) => toast.error(`Erro ao importar: ${err.message}`),
  });
}
