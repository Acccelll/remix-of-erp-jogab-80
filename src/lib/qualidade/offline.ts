/** @module-kind pure */
/**
 * Captura offline-first de inspeções (INSP.3).
 *
 * Reusa o motor offline genérico (`useOfflineRecord`) — toda a parte difícil
 * (IndexedDB, sync_queue idempotente, media_queue com backoff) já está
 * resolvida e testada. Aqui só ensinamos a traduzir o estado da inspeção em
 * mutações idempotentes (uma EnqueueInput por linha remota).
 *
 * Tabelas envolvidas:
 *  - inspecoes (cabeçalho)
 *  - inspecao_respostas (uma por pergunta respondida)
 *  - inspecao_fotos (uma por foto; o uploader atualiza `storage_path` ao subir)
 *  - nao_conformidades (NCs disparadas automaticamente por `geraNcSe`)
 *
 * Idempotência: cada linha tem UUID gerado no cliente; reenviar é seguro.
 */
import type { EnqueueInput } from "@/lib/offline/sync-queue";
import { ncsDisparadas, type ModeloTemplate, type RespostasMap } from "./modelos";

export interface InspecaoRespostaLocal {
  id: string;
  perguntaId: string; // UUID da pergunta no banco
  perguntaTempId: string; // tempId do modelo (para condicionais locais)
  resposta_texto?: string;
  resposta_numero?: number;
  resposta_opcao?: string;
  conformidade?: "sim" | "nao" | "na";
  observacao?: string;
}

export interface InspecaoFotoLocal {
  id: string;
  respostaId: string;
  path: string;
  legenda?: string;
}

export interface InspecaoNcLocal {
  id: string;
  respostaId: string;
  perguntaTempId: string;
  titulo: string;
  severidade: "baixa" | "media" | "alta" | "critica";
  /** Assinatura para deduplicar reincidência: modeloId + perguntaTempId + local. */
  assinatura: string;
}

export interface InspecaoData {
  inspecao_id: string;
  modelo_id: string;
  obra_id: string;
  cronograma_item_id?: string;
  card_id?: string;
  local?: string;
  responsavel_id?: string;
  data_planejada?: string;
  observacao?: string;
  assinatura_path?: string;
  status: "rascunho" | "em_execucao" | "concluida";
  /** Map perguntaTempId → resposta para alimentar condicionais. */
  respostas: Record<string, InspecaoRespostaLocal>;
  fotos: InspecaoFotoLocal[];
  ncs: InspecaoNcLocal[];
}

export function emptyInspecao(args: {
  modeloId: string;
  obraId: string;
  responsavelId?: string;
  cronogramaItemId?: string;
  cardId?: string;
}): InspecaoData {
  return {
    inspecao_id: crypto.randomUUID(),
    modelo_id: args.modeloId,
    obra_id: args.obraId,
    responsavel_id: args.responsavelId,
    cronograma_item_id: args.cronogramaItemId,
    card_id: args.cardId,
    status: "rascunho",
    respostas: {},
    fotos: [],
    ncs: [],
  };
}

export interface MutationCtx {
  modelo: ModeloTemplate;
  createdBy: string;
  /** Score calculado no cliente; o servidor pode recalcular. */
  score?: number;
}

/**
 * Traduz o estado da inspeção em itens da fila. Pura — sem I/O.
 */
export function inspecaoToMutations(d: InspecaoData, ctx: MutationCtx): EnqueueInput[] {
  const ops: EnqueueInput[] = [];

  ops.push({
    id: d.inspecao_id,
    table: "inspecoes",
    payload: {
      id: d.inspecao_id,
      modelo_id: d.modelo_id,
      obra_id: d.obra_id,
      cronograma_item_id: d.cronograma_item_id ?? null,
      card_id: d.card_id ?? null,
      local: d.local ?? null,
      responsavel_id: d.responsavel_id ?? null,
      data_planejada: d.data_planejada ?? null,
      data_inspecao: d.status === "concluida" ? new Date().toISOString() : null,
      status: d.status,
      score: ctx.score ?? null,
      aprovado:
        ctx.score !== undefined && ctx.modelo.scoreMinimo !== undefined
          ? ctx.score >= ctx.modelo.scoreMinimo
          : null,
      observacao: d.observacao ?? null,
      assinatura_path: d.assinatura_path ?? null,
      created_by: ctx.createdBy,
    },
  });

  for (const r of Object.values(d.respostas)) {
    ops.push({
      id: r.id,
      table: "inspecao_respostas",
      payload: {
        id: r.id,
        inspecao_id: d.inspecao_id,
        pergunta_id: r.perguntaId,
        resposta_texto: r.resposta_texto ?? null,
        resposta_numero: r.resposta_numero ?? null,
        resposta_opcao: r.resposta_opcao ?? null,
        conformidade: r.conformidade ?? null,
        observacao: r.observacao ?? null,
      },
      onConflict: "inspecao_id,pergunta_id",
    });
  }

  for (const f of d.fotos) {
    ops.push({
      id: f.id,
      table: "inspecao_fotos",
      payload: {
        id: f.id,
        resposta_id: f.respostaId,
        storage_path: f.path, // o uploader sobrescreve depois do upload real
        legenda: f.legenda ?? null,
      },
    });
  }

  for (const n of d.ncs) {
    ops.push({
      id: n.id,
      table: "nao_conformidades",
      payload: {
        id: n.id,
        obra_id: d.obra_id,
        inspecao_id: d.inspecao_id,
        resposta_id: n.respostaId,
        card_id: d.card_id ?? null,
        cronograma_item_id: d.cronograma_item_id ?? null,
        titulo: n.titulo,
        severidade: n.severidade,
        status: "aberta",
        assinatura: n.assinatura,
        created_by: ctx.createdBy,
      },
    });
  }

  return ops;
}

/**
 * A partir das respostas atuais, calcula as NCs que precisam existir e
 * reconcilia com a lista local — preserva o `id` quando a NC já existia
 * para a mesma resposta+pergunta (idempotência no upsert).
 */
export function reconcilarNcs(
  modelo: ModeloTemplate,
  respostas: Record<string, InspecaoRespostaLocal>,
  ncsAtuais: InspecaoNcLocal[],
  local?: string,
): InspecaoNcLocal[] {
  const respostasMap: RespostasMap = {};
  for (const r of Object.values(respostas)) {
    respostasMap[r.perguntaTempId] =
      r.conformidade ?? r.resposta_opcao ?? r.resposta_texto ?? r.resposta_numero;
  }

  const ativas = ncsDisparadas(modelo, respostasMap);
  const porPergunta = new Map(ncsAtuais.map((n) => [n.perguntaTempId, n]));

  return ativas.map((p) => {
    const resposta = Object.values(respostas).find((r) => r.perguntaTempId === p.tempId);
    const existente = porPergunta.get(p.tempId);
    return {
      id: existente?.id ?? crypto.randomUUID(),
      respostaId: resposta?.id ?? "",
      perguntaTempId: p.tempId,
      titulo: `NC automática: ${p.texto}`,
      severidade: (p.peso ?? 1) >= 3 ? "alta" : "media",
      assinatura: `${modelo.codigo}|${p.tempId}|${local ?? ""}`,
    };
  });
}
