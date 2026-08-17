/** @module-kind pure */
import type { ResumoMensalLinha } from "./resumo-mensal";

export type ResumoMensalCsvOpts = {
  obraNome: (id: string) => string;
};

const CSV_HEADER = [
  "mes",
  "obra",
  "assinado_por",
  "fechados",
  "primeiro_numero",
  "ultimo_numero",
] as const;

function escapeCell(value: string | number | null): string {
  const str = value == null ? "" : String(value);
  if (/[",;\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Serializa o resumo mensal para CSV (separador ';', compatível com Excel pt-BR).
 * Prefixa BOM UTF-8 para preservar acentos ao abrir no Excel.
 */
export function resumoMensalToCsv(
  linhas: ResumoMensalLinha[],
  opts: ResumoMensalCsvOpts,
): string {
  const rows: string[] = [];
  rows.push(CSV_HEADER.join(";"));
  for (const l of linhas) {
    rows.push(
      [
        l.mes,
        opts.obraNome(l.obra_id),
        l.assinado_por,
        l.total,
        l.primeiro_numero ?? "",
        l.ultimo_numero ?? "",
      ]
        .map(escapeCell)
        .join(";"),
    );
  }
  return "\uFEFF" + rows.join("\r\n");
}

export function nomeArquivoResumo(de: string, ate: string): string {
  return `rdo-resumo-mensal_${de}_a_${ate}.csv`;
}
