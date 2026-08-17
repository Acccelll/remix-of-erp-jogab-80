/** @module-kind io */
// Recalcula o caminho crítico + importância de uma obra e persiste via RPC.

import {
  cronogramaRepo,
  cronogramaDependenciasRepo,
  cronogramaCalendariosRepo,
  cronogramaCalendarioExcecoesRepo,
} from "@/lib/repositories/cronograma";
import {
  computeCpmDetalhado,
  diasAtrasoCaminhoCritico,
  type CpmDep,
  type CpmItem,
} from "@/lib/cronograma/cpm";
import { CALENDARIO_PADRAO, type Calendario } from "@/lib/cronograma/calendario";
import { calcularFanoutTransitivo, calcularImportancia } from "@/lib/cronograma/importancia";

export type RecalcResult = {
  itens: number;
  criticas: number;
  atrasoCaminhoCritico: number;
};

async function carregarCalendarios(obraId: string): Promise<{
  padrao: Calendario;
  porUid: Map<string, Calendario>;
}> {
  const cals = await cronogramaCalendariosRepo.listByObra(obraId);
  const ids = (cals ?? []).map((c: any) => c.id);
  const excsRaw = await cronogramaCalendarioExcecoesRepo.listByCalendarioIds(ids);
  // Apenas exceções confirmadas entram no CPM (propostas via RDO ficam em rascunho).
  const excs = (excsRaw ?? []).filter((e: any) => e.confirmada !== false);

  const porUid = new Map<string, Calendario>();
  let padrao: Calendario = CALENDARIO_PADRAO;
  for (const c of cals ?? []) {
    const cal: Calendario = {
      dias_uteis: (c.dias_uteis ?? [1, 2, 3, 4, 5]) as number[],
      horas_por_dia: Number(c.horas_por_dia ?? 8),
      excecoes: excs
        .filter((e: any) => e.calendario_id === c.id)
        .map((e: any) => ({
          data_inicio: e.data_inicio,
          data_fim: e.data_fim,
          trabalha: !!e.trabalha,
          horas_disponiveis: e.horas_disponiveis != null ? Number(e.horas_disponiveis) : null,
        })),
    };
    if (c.uid_mpp) porUid.set(String(c.uid_mpp), cal);
    if (c.is_padrao) padrao = cal;
  }
  return { padrao, porUid };
}

export async function recalcularCpmObra(obraId: string): Promise<RecalcResult> {
  const itens = await cronogramaRepo.listCpmByObra(obraId);
  const ativos = (itens ?? []).filter((i: any) => i.ativo !== false);
  if (ativos.length === 0) return { itens: 0, criticas: 0, atrasoCaminhoCritico: 0 };

  const deps = await cronogramaDependenciasRepo.listByObra(obraId);

  const { padrao, porUid } = await carregarCalendarios(obraId);
  const calendarioPorItem = new Map<string, Calendario>();
  for (const it of ativos as any[]) {
    if (it.calendario_uid_mpp && porUid.has(String(it.calendario_uid_mpp))) {
      calendarioPorItem.set(it.id, porUid.get(String(it.calendario_uid_mpp))!);
    }
  }
  const usaCalendario = porUid.size > 0;

  const cpmItens: CpmItem[] = ativos.map((i: any) => ({
    id: i.id,
    uid_mpp: i.uid_mpp,
    data_inicio: i.data_inicio,
    data_fim: i.data_fim,
    calendario_uid_mpp: i.calendario_uid_mpp ?? null,
  }));
  const cpmDeps: CpmDep[] = (deps ?? []).map((d: any) => ({
    item_id: d.item_id,
    predecessor_uid_mpp: d.predecessor_uid_mpp,
    predecessor_item_id: d.predecessor_item_id ?? null,
    tipo: d.tipo,
    lag_dias: Number(d.lag_dias ?? 0),
    lag_minutos: d.lag_minutos != null ? Number(d.lag_minutos) : null,
  }));

  const opts = usaCalendario ? { calendarioPadrao: padrao, calendarioPorItem } : undefined;
  const detalhe = computeCpmDetalhado(cpmItens, cpmDeps, opts);
  const result = detalhe.map((d) => ({ id: d.id, folga_dias: d.folga_dias, critico: d.critico }));

  // Importância
  const fanout = calcularFanoutTransitivo(
    ativos.map((i: any) => ({ id: i.id })),
    (deps ?? []).map((d: any) => ({
      item_id: d.item_id,
      predecessor_item_id: d.predecessor_item_id,
    })),
  );
  const imp = calcularImportancia(
    ativos.map((i: any) => {
      const d = detalhe.find((x) => x.id === i.id);
      return {
        id: i.id,
        folga_total_dias: d?.folga_total_dias ?? 0,
        folga_livre_dias: d?.folga_livre_dias ?? 0,
        custo: Number(i.custo ?? 0),
      };
    }),
    fanout,
  );
  const impById = new Map(imp.map((r) => [r.id, r]));

  const payload = detalhe.map((r) => {
    const im = impById.get(r.id);
    return {
      id: r.id,
      item_id: r.id,
      folga_dias: r.folga_dias,
      folga_total: r.folga_total_dias,
      folga_total_dias: r.folga_total_dias,
      critico: r.critico,
      caminho_critico: r.critico,
      folga_livre_dias: r.folga_livre_dias,
      fanout: im?.fanout ?? 0,
      fanout_sucessoras: im?.fanout ?? 0,
      score: im?.score ?? null,
      importancia_score: im?.score ?? null,
      classe: im?.classe ?? null,
      importancia_classe: im?.classe ?? null,
    };
  });

  await cronogramaRepo.rpcAtualizarCpm(obraId, payload);

  const criticas = result.filter((r) => r.critico).length;
  const atraso = diasAtrasoCaminhoCritico(
    ativos.map((i: any) => ({
      id: i.id,
      data_fim: i.data_fim,
      data_fim_baseline: i.data_fim_baseline,
    })),
    result,
  );
  return { itens: ativos.length, criticas, atrasoCaminhoCritico: atraso };
}
