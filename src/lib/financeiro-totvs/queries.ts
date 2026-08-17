/** @module-kind io */
// Queries centralizadas do módulo Financeiro TOTVS.
// ARC-003 — acesso a dados delegado a `financeiroTotvsRepo`.

import { queryKey } from "@/lib/query-keys";
import { financeiroTotvsRepo } from "@/lib/repositories/financeiro";
import { withDeadline } from "@/lib/core/http/withDeadline";
import type { FinLinha } from "./agregacoes";
import type { RollupLinha } from "./evolucao";

/** SEC-006 slice-04: teto p/ reads pesadas de dashboards financeiros. */
const READ_DEADLINE_MS = 15_000;

export const finKeys = {
  geral: queryKey("fin_geral"),
  obra: (obraId: string) => queryKey("fin_obra", obraId),
  confronto: (obraId: string) => queryKey("fin_confronto", obraId),
  natureza: (filtros: Record<string, unknown>) => queryKey("fin_natureza", filtros),
  snapshot: queryKey("fin_snapshot_ativo"),
  evolucao: (filtros: { obraId?: string | null } = {}) => queryKey("fin_evolucao", filtros),
};

// Colunas exatas usadas por FinLinha — evita puxar campos da view não consumidos.
const FIN_LINHA_COLS = [
  "lancamento_id",
  "obra_id",
  "obra_nome",
  "obra_codigo",
  "natureza_tipo",
  "status_cod",
  "status_label",
  "grupo",
  "subgrupo",
  "cod_natureza",
  "desc_natureza",
  "valor_liquido",
  "valor_baixado",
  "valor_rateio",
  "mes_competencia",
  "data_vencimento",
  "data_pagamento",
  "contraparte",
  "ref_lancamento",
  "centro_custo",
  "desc_centro_custo",
  "centro_custo_tipo",
  "categoria_indireta",
].join(", ");

async function fetchAllFinanceiroRows(obraId?: string): Promise<FinLinha[]> {
  return (await withDeadline(
    financeiroTotvsRepo.listVwFinanceiroObraPaged(FIN_LINHA_COLS, obraId),
    READ_DEADLINE_MS,
    obraId ? `fin.listVwFinanceiroObraPaged.${obraId}` : "fin.listVwFinanceiroObraPaged.all",
  )) as FinLinha[];
}

/**
 * Histórico permanente de evolução de dívidas (rollup), todas as datas.
 * Quando há mais de um snapshot no mesmo dia, apenas o MAIS RECENTE
 * (por `importado_em`) é considerado.
 */
export async function fetchEvolucaoRollup(
  opts: { obraId?: string | null } = {},
): Promise<RollupLinha[]> {
  const snaps = await withDeadline(
    financeiroTotvsRepo.listSnapshotsIdImportadoEm(),
    READ_DEADLINE_MS,
    "fin.listSnapshotsIdImportadoEm",
  );
  const oficialPorData = new Map<string, string>();
  for (const s of snaps) {
    const data = String(s.data_ref ?? s.importado_em).slice(0, 10);
    if (!oficialPorData.has(data)) oficialPorData.set(data, s.id);
  }
  const snapshotIds = Array.from(oficialPorData.values());
  if (snapshotIds.length === 0) return [];
  const rows = await withDeadline(
    financeiroTotvsRepo.listEvolucaoRollup(snapshotIds, opts.obraId),
    READ_DEADLINE_MS,
    "fin.listEvolucaoRollup",
  );
  return rows as unknown as RollupLinha[];
}

/** Linhas da view do snapshot mais recente (todas as obras do usuário). */
export async function fetchFinanceiroGeral(): Promise<FinLinha[]> {
  return fetchAllFinanceiroRows();
}

/** Linhas da view filtradas por obra. */
export async function fetchFinanceiroObra(obraId: string): Promise<FinLinha[]> {
  return fetchAllFinanceiroRows(obraId);
}

/** Snapshot ativo (o mais recente). */
export async function fetchSnapshotAtivo() {
  return financeiroTotvsRepo.getSnapshotAtivo();
}

/** Lista de obras do usuário com seu vínculo TOTVS e valor de contrato. */
export async function fetchObrasComVinculo() {
  return financeiroTotvsRepo.listObrasComVinculo();
}

/** BMS previstas de uma obra. Somente leitura. */
export async function fetchBmsPrevistas(obraId: string) {
  return financeiroTotvsRepo.listBmsPrevistas(obraId);
}

/** Recebimentos de uma obra. Somente leitura. */
export async function fetchRecebimentos(obraId: string) {
  return financeiroTotvsRepo.listRecebimentos(obraId);
}

/** Notas fiscais emitidas de uma obra. Somente leitura. */
export async function fetchNotasFiscais(obraId: string) {
  return financeiroTotvsRepo.listNotasFiscais(obraId);
}
