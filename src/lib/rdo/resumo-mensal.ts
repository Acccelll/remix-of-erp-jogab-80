/** @module-kind pure */
import { parseISO, format } from "date-fns";

export type RdoFechadoRow = {
  id: string;
  obra_id: string;
  data: string;
  status: string;
  fechado_em: string | null;
  assinado_por: string | null;
  numero_documental: string | null;
};

export type ResumoMensalLinha = {
  chave: string;
  mes: string; // yyyy-MM
  obra_id: string;
  assinado_por: string;
  total: number;
  primeiro_numero: string | null;
  ultimo_numero: string | null;
};

/**
 * Agrupa RDOs fechados por mês (data do RDO), obra e assinante.
 * Retorna linhas ordenadas por mês desc, obra, assinante.
 */
export function resumoMensalFechados(rows: RdoFechadoRow[]): ResumoMensalLinha[] {
  const map = new Map<string, ResumoMensalLinha>();
  for (const r of rows) {
    if (r.status !== "fechado") continue;
    const mes = format(parseISO(r.data), "yyyy-MM");
    const assinante = (r.assinado_por ?? "").trim() || "—";
    const chave = `${mes}|${r.obra_id}|${assinante}`;
    let linha = map.get(chave);
    if (!linha) {
      linha = {
        chave,
        mes,
        obra_id: r.obra_id,
        assinado_por: assinante,
        total: 0,
        primeiro_numero: null,
        ultimo_numero: null,
      };
      map.set(chave, linha);
    }
    linha.total += 1;
    if (r.numero_documental) {
      if (!linha.primeiro_numero || r.numero_documental < linha.primeiro_numero) {
        linha.primeiro_numero = r.numero_documental;
      }
      if (!linha.ultimo_numero || r.numero_documental > linha.ultimo_numero) {
        linha.ultimo_numero = r.numero_documental;
      }
    }
  }
  return [...map.values()].sort((a, b) => {
    if (a.mes !== b.mes) return b.mes.localeCompare(a.mes);
    if (a.obra_id !== b.obra_id) return a.obra_id.localeCompare(b.obra_id);
    return a.assinado_por.localeCompare(b.assinado_por);
  });
}
