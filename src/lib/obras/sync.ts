/** @module-kind orchestration */
// BIZ-002.c — orquestra persistência de Obra: repositório (banco) + api (PHP legado).
// Payload puro extraído para ./payload.ts.
import { api } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { obrasRepo } from "@/lib/repositories/obras";
import {
  criticalFlowIds,
  noteCriticalFlowFail,
  noteCriticalFlowOk,
} from "@/lib/observability/critical-flows";
import type { Obra } from "@/types";
import { buildObraPayload } from "./payload";

const isUuid = (value?: string) =>
  !!value &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

async function fetchConflictInfo(centro: string) {
  const { data } = await supabase
    .from("obras")
    .select("id, codigo, nome")
    .eq("centro_custo_totvs", centro)
    .maybeSingle();
  return data as { id: string; codigo: string | null; nome: string | null } | null;
}

function friendlyDuplicateError(err: unknown, centro: string, conflict: Awaited<ReturnType<typeof fetchConflictInfo>>) {
  const nome = conflict?.nome ?? "(sem nome)";
  const codigo = conflict?.codigo ?? "?";
  const msg =
    `Centro de custo TOTVS "${centro}" já está em uso pela obra "${nome}" (código ${codigo}). ` +
    `Cada obra precisa ter um centro_custo_totvs único — altere o código desta obra ou reconcilie com a existente.`;
  const wrapped = new Error(msg);
  (wrapped as any).cause = err;
  (wrapped as any).conflict = conflict;
  return wrapped;
}

function isUniqueViolation(err: any): boolean {
  const code = err?.code || err?.cause?.code;
  const message = String(err?.message || "");
  return code === "23505" || /obras_centro_custo_totvs_uidx|duplicate key/i.test(message);
}

/**
 * Cria ou atualiza a obra no banco e retorna o UUID.
 * Se a obra ainda não tem flowcastId, salva o UUID de volta no PHP.
 *
 * Reconciliação: se o flowcastId local não corresponde a nenhuma linha,
 * usa o `centro_custo_totvs` como chave alternativa antes de inserir,
 * evitando violar o índice único `obras_centro_custo_totvs_uidx`.
 */
export async function syncObraToSupabase(obra: Obra): Promise<string> {
  const payload = buildObraPayload(obra);
  try {
    // 1) Tenta atualizar pelo flowcastId local (caminho feliz).
    if (isUuid(obra.flowcastId)) {
      const id = await obrasRepo.updateReturningId(obra.flowcastId!, payload as any);
      if (id) {
        noteCriticalFlowOk(criticalFlowIds.obraSync, { obraId: obra.id, mirroredId: id });
        return id;
      }
    }

    // 2) Reconcilia pelo centro_custo_totvs (índice único). Cobre o caso
    //    em que o flowcastId local está dessincronizado do UUID real.
    if (payload.centro_custo_totvs) {
      const existenteId = await obrasRepo.getIdByCentroCustoTotvs(payload.centro_custo_totvs);
      if (existenteId) {
        const id = (await obrasRepo.updateReturningId(existenteId, payload as any)) ?? existenteId;
        await api.update("obras", obra.id, { flowcastId: id });
        noteCriticalFlowOk(criticalFlowIds.obraSync, {
          obraId: obra.id,
          mirroredId: id,
          reconciled: true,
        });
        return id;
      }
    }

    // 3) Nenhuma linha encontrada — insere.
    const newId = await obrasRepo.insertReturningId(payload as any);
    await api.update("obras", obra.id, { flowcastId: newId });
    noteCriticalFlowOk(criticalFlowIds.obraSync, { obraId: obra.id, mirroredId: newId });
    return newId;
  } catch (err) {
    // Traduz violação do índice único em mensagem legível para o usuário.
    if (isUniqueViolation(err) && payload.centro_custo_totvs) {
      const conflict = await fetchConflictInfo(payload.centro_custo_totvs).catch(() => null);
      const friendly = friendlyDuplicateError(err, payload.centro_custo_totvs, conflict);
      noteCriticalFlowFail(criticalFlowIds.obraSync, friendly, {
        obraId: obra.id,
        centro: payload.centro_custo_totvs,
        conflictId: conflict?.id,
      });
      throw friendly;
    }
    noteCriticalFlowFail(criticalFlowIds.obraSync, err, { obraId: obra.id });
    throw err;
  }
}

/** Lê a obra de volta no PHP e confirma se o `flowcastId` foi realmente gravado. */
async function persistiuFlowcastId(obraId: string, esperado: string): Promise<boolean> {
  try {
    const row: any = await api.getById("obras", obraId);
    const atual = row?.flowcastId ?? row?.flowcast_id ?? null;
    return String(atual ?? "") === esperado;
  } catch {
    return false;
  }
}

/**
 * Reconcilia uma lista de obras: para cada uma com flowcastId ausente ou
 * dessincronizado, tenta localizar a linha existente por `centro_custo_totvs`
 * e grava o UUID correto de volta no PHP. Retorna o resumo do que foi feito.
 *
 * `naoPersistidas` sinaliza que o backend legado aceitou o PUT mas não gravou
 * o campo (coluna `flowcastId` provavelmente ausente na tabela `obras`).
 */
export async function reconciliarObrasFlowcastId(obras: Obra[]): Promise<{
  reconciliadas: Array<{ obraId: string; flowcastId: string }>;
  naoPersistidas: Array<{ obraId: string; flowcastId: string }>;
  semCentroCusto: string[];
  naoEncontradas: string[];
  jaSincronizadas: number;
}> {
  const reconciliadas: Array<{ obraId: string; flowcastId: string }> = [];
  const naoPersistidas: Array<{ obraId: string; flowcastId: string }> = [];
  const semCentroCusto: string[] = [];
  const naoEncontradas: string[] = [];
  let jaSincronizadas = 0;

  for (const obra of obras) {
    const centro = (obra as any).centroCustoTotvs || (obra as any).centro_custo_totvs;
    if (isUuid(obra.flowcastId)) {
      // Verifica se ainda existe no banco.
      const nome = await obrasRepo.getNome(obra.flowcastId!).catch(() => null);
      if (nome) {
        jaSincronizadas += 1;
        continue;
      }
    }
    if (!centro) {
      semCentroCusto.push(obra.id);
      continue;
    }
    const existenteId = await obrasRepo.getIdByCentroCustoTotvs(centro).catch(() => null);
    if (!existenteId) {
      naoEncontradas.push(obra.id);
      continue;
    }
    await api.update("obras", obra.id, { flowcastId: existenteId });
    if (await persistiuFlowcastId(obra.id, existenteId)) {
      reconciliadas.push({ obraId: obra.id, flowcastId: existenteId });
    } else {
      naoPersistidas.push({ obraId: obra.id, flowcastId: existenteId });
    }
  }

  return { reconciliadas, naoPersistidas, semCentroCusto, naoEncontradas, jaSincronizadas };
}

