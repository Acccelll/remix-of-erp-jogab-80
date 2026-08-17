/** @module-kind pure */
/**
 * Situação dos documentos de um colaborador.
 *
 * Extraído de `BoardColabCard` quando o mapa de logística passou a precisar do
 * mesmo indicador: um colaborador com documento vencido não pode ser mobilizado
 * sem regularização, e essa informação tem que aparecer igual nos dois lugares.
 */
import { fmtDataLocal } from "@/lib/core/date";
import type { Colaborador } from "@/types";

export type DocStatus = {
  kind: "vencido" | "vencendo";
  label: string;
  tooltip: string;
} | null;

/** Janela de antecedência do aviso "a vencer", em dias. */
export const DIAS_AVISO_VENCIMENTO = 30;

/**
 * Documento mais crítico do colaborador dentro da janela de aviso, ou `null`
 * quando está tudo em dia. "Vencido" tem precedência sobre "a vencer" por
 * consequência da ordenação: o vencimento mais antigo vence o desempate.
 */
export function computeDocStatus(colab: Colaborador, agora: number = Date.now()): DocStatus {
  if (!Array.isArray(colab.documentos) || colab.documentos.length === 0) return null;

  const limite = agora + DIAS_AVISO_VENCIMENTO * 24 * 60 * 60 * 1000;
  let pior: { t: number; nome: string; vencido: boolean } | null = null;

  for (const d of colab.documentos) {
    if (!d.dataVencimento) continue;
    const t = new Date(d.dataVencimento).getTime();
    if (Number.isNaN(t) || t > limite) continue;
    const vencido = t < agora;
    if (!pior || t < pior.t) pior = { t, nome: d.nome, vencido };
  }

  if (!pior) return null;
  const dt = fmtDataLocal(pior.t);
  return pior.vencido
    ? { kind: "vencido", label: "Doc vencido", tooltip: `${pior.nome} venceu em ${dt}` }
    : { kind: "vencendo", label: "Doc a vencer", tooltip: `${pior.nome} vence em ${dt}` };
}
