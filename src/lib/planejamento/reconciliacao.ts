/** @module-kind pure */
/**
 * Reconciliação Lean × CPM.
 *
 * Cruza itens de cronograma (CPM) com pacotes de trabalho (Lean) para
 * expor três lacunas típicas do planejamento de obra:
 *
 *  - itens de cronograma sem qualquer pacote (atividade CPM não coberta);
 *  - pacotes órfãos, sem `cronograma_item_id` (Lean solto);
 *  - itens com pacotes 100% concluídos mas cujo item CPM ainda não
 *    foi marcado como concluído (candidato a atualização do cronograma).
 *
 * Regra pura sem dependência de banco — consumidores injetam os dados
 * já filtrados por obra.
 */

export interface CronogramaItemLite {
  id: string;
  obra_id: string;
  nome: string;
  status: string | null;
}

export interface PacoteReconLite {
  id: string;
  obra_id: string;
  cronograma_item_id: string | null;
  status: string | null;
}

export interface CoberturaItem {
  item_id: string;
  obra_id: string;
  nome: string;
  status_cpm: string | null;
  total_pacotes: number;
  comprometidos: number;
  concluidos: number;
  /** cobertura Lean está completa (>=1 pacote e todos concluídos). */
  completo_lean: boolean;
  /** item CPM ainda "aberto" com todos os pacotes concluídos. */
  divergente: boolean;
}

export interface ReconciliacaoResumo {
  itens_sem_pacote: CronogramaItemLite[];
  pacotes_orfaos: PacoteReconLite[];
  cobertura: CoberturaItem[];
  itens_divergentes: CoberturaItem[];
  totais: {
    itens: number;
    itens_cobertos: number;
    pacotes: number;
    pacotes_orfaos: number;
  };
}

const STATUS_CPM_CONCLUIDO = new Set(["concluido", "concluida", "concluído", "concluída"]);

export function reconciliarLeanCpm(
  itens: CronogramaItemLite[],
  pacotes: PacoteReconLite[],
): ReconciliacaoResumo {
  const pacotesPorItem = new Map<string, PacoteReconLite[]>();
  const pacotes_orfaos: PacoteReconLite[] = [];

  for (const p of pacotes) {
    if (!p.cronograma_item_id) {
      pacotes_orfaos.push(p);
      continue;
    }
    const arr = pacotesPorItem.get(p.cronograma_item_id) ?? [];
    arr.push(p);
    pacotesPorItem.set(p.cronograma_item_id, arr);
  }

  const cobertura: CoberturaItem[] = itens.map((it) => {
    const ps = pacotesPorItem.get(it.id) ?? [];
    const comprometidos = ps.filter(
      (p) => p.status === "comprometido" || p.status === "concluido",
    ).length;
    const concluidos = ps.filter((p) => p.status === "concluido").length;
    const completo_lean = ps.length > 0 && concluidos === ps.length;
    const cpmConcluido = it.status
      ? STATUS_CPM_CONCLUIDO.has(it.status.toLowerCase())
      : false;
    return {
      item_id: it.id,
      obra_id: it.obra_id,
      nome: it.nome,
      status_cpm: it.status,
      total_pacotes: ps.length,
      comprometidos,
      concluidos,
      completo_lean,
      divergente: completo_lean && !cpmConcluido,
    };
  });

  const itens_sem_pacote = itens.filter((it) => !pacotesPorItem.has(it.id));
  const itens_divergentes = cobertura.filter((c) => c.divergente);
  const itens_cobertos = cobertura.filter((c) => c.total_pacotes > 0).length;

  return {
    itens_sem_pacote,
    pacotes_orfaos,
    cobertura,
    itens_divergentes,
    totais: {
      itens: itens.length,
      itens_cobertos,
      pacotes: pacotes.length,
      pacotes_orfaos: pacotes_orfaos.length,
    },
  };
}
