/** @module-kind pure */
// ac-folha.ts — AC primário do EVM a partir da folha (custo_colaborador_competencia / dp_holerite).
//
// Decisão 1: custo de pessoal vem do holerite importado no Planifik.
// TOTVS é apenas conciliação/complemento.
//
// Regra de não-duplicação:
//   Por centro_custo_totvs.codigo + competência, prevalece a folha.
//   O TOTVS só preenche meses/CCs ausentes na folha.

import { round2 } from "@/lib/core/money";
import type { EvmAcReal } from "./evm";

export interface FolhaLinha {
  /** Código TOTVS do centro de custo (== centros_custo_totvs.codigo). */
  centro_custo_id: string;
  /** Competência no formato YYYY-MM ou YYYY-MM-DD (usamos só YYYY-MM). */
  competencia: string;
  /** Custo total do colaborador naquela competência/CC. */
  custo_total: number;
}

/**
 * Constrói o AC do EVM a partir das linhas de folha (custo_colaborador_competencia).
 * Agrupa por mes_competencia (YYYY-MM); soma custo_total.
 */
export function construirAcFolha(linhas: FolhaLinha[] | null | undefined): EvmAcReal {
  if (!linhas?.length) return { porMes: [], total: 0 };
  const porMes = new Map<string, number>();
  let total = 0;
  for (const l of linhas) {
    const mes = (l.competencia ?? "").slice(0, 7); // YYYY-MM
    if (!mes) continue;
    const v = Number(l.custo_total ?? 0) || 0;
    if (!v) continue;
    porMes.set(mes, (porMes.get(mes) ?? 0) + v);
    total += v;
  }
  const arr = Array.from(porMes.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, valor]) => ({ mes, valor: round2(valor) }));
  return { porMes: arr, total: round2(total) };
}

/**
 * Mescla AC da folha (primário) com AC do TOTVS (complemento).
 *
 * Regra: para cada mês presente na folha, prevalece a folha.
 * O TOTVS só preenche meses ausentes na folha (sem dupla contagem).
 */
export function mesclarAcFolhaTotvs(acFolha: EvmAcReal, acTotvs: EvmAcReal): EvmAcReal {
  const mesesFolha = new Set(acFolha.porMes.map((m) => m.mes));
  const complemento = acTotvs.porMes.filter((m) => !mesesFolha.has(m.mes));
  const merged = [...acFolha.porMes, ...complemento].sort((a, b) => a.mes.localeCompare(b.mes));
  const total = round2(merged.reduce((acc, m) => acc + m.valor, 0));
  return { porMes: merged, total };
}

/**
 * Gera a estrutura EvmAcReal a partir da tabela custo_colaborador_competencia
 * filtrada por obra (via centros_custo_totvs).
 *
 * Query Supabase esperada (chamar externamente):
 *   supabase
 *     .from('custo_colaborador_competencia')
 *     .select('centro_custo_id, competencia, custo_total')
 *     .eq('centro_custo_totvs_id', centroId)  // ou join por obra_id
 */
export function acFolhaDeCustos(
  rows: { centro_custo_id: string | null; competencia: string; custo_total: number }[],
): EvmAcReal {
  const mapped: FolhaLinha[] = rows
    .filter((r) => r.centro_custo_id != null)
    .map((r) => ({
      centro_custo_id: r.centro_custo_id!,
      competencia: r.competencia,
      custo_total: r.custo_total,
    }));
  return construirAcFolha(mapped);
}
