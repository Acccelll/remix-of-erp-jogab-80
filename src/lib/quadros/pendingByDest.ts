/** @module-kind pure */
import type { Colaborador, Obra } from "@/types";

export interface PendingEntry {
  nome: string;
  matricula: string;
  data: string;
  origem: string;
}

const SPECIAL_NAMES: Record<string, string> = {
  __folga__: "Folga",
  folga: "Folga",
  __afastamento__: "Afastamento",
  afastamento: "Afastamento",
  __ferias__: "Férias",
  ferias: "Férias",
};

/**
 * Agrupa mobilizações pendentes pelos IDs de coluna destino.
 * - Chave `__none__` cobre destino "Sem alocação".
 * - Considera apenas colaboradores ativos com `mobilizacaoPendente` definido.
 * - Resolve o nome da origem usando `statusEspecial`, `obraAtualId` e a lista de obras.
 */
export function computePendingByDest(
  colaboradores: Colaborador[],
  obras: Obra[],
): Map<string, PendingEntry[]> {
  const map = new Map<string, PendingEntry[]>();
  const colNameById = new Map<string, string>();
  for (const o of obras) colNameById.set(o.id, o.nome);

  for (const c of colaboradores) {
    if (!c.ativo || !c.mobilizacaoPendente) continue;
    const destRaw = c.mobilizacaoPendente.obraDestinoId || "";
    const key = destRaw || "__none__";
    const origemKey = c.statusEspecial || c.obraAtualId || null;
    const origem = origemKey
      ? SPECIAL_NAMES[origemKey] || colNameById.get(origemKey) || "—"
      : "Sem alocação";
    const entry: PendingEntry = {
      nome: c.nome,
      matricula: c.matricula,
      data: c.mobilizacaoPendente.dataMobilizacao,
      origem,
    };
    const arr = map.get(key);
    if (arr) arr.push(entry);
    else map.set(key, [entry]);
  }
  return map;
}
