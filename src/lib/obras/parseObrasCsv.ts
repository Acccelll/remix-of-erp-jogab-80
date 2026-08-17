/** @module-kind pure */
/**
 * Parser do CSV oficial de obras (export do sistema legado).
 * Aceita as colunas:
 *   codigo,nome,cliente,status,ativa,valor_contrato,data_inicio,
 *   data_previsao_termino,data_fim,local,pedido_contrato,
 *   centro_custo_totvs,data_mobilizacao,data_desmobilizacao,created_at
 *
 * Saída: array de objetos prontos para `obras_upsert_lote(payload jsonb)`.
 */

export interface ObraImportRow {
  codigo: string;
  nome: string;
  cliente: string | null;
  status: string | null;
  ativa: boolean;
  valor_contrato: string | null;
  data_inicio: string | null;
  data_previsao_termino: string | null;
  data_fim: string | null;
  local: string | null;
  pedido_contrato: string | null;
  centro_custo_totvs: string | null;
  data_mobilizacao: string | null;
  data_desmobilizacao: string | null;
}

export interface ParseObrasResult {
  rows: ObraImportRow[];
  erros: Array<{ linha: number; mensagem: string }>;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = false;
      } else cur += ch;
    } else {
      if (ch === ",") {
        out.push(cur);
        cur = "";
      } else if (ch === '"') inQ = true;
      else cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function splitCsv(text: string): string[][] {
  // Suporta campos multilinha entre aspas
  const rows: string[][] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQ && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQ = !inQ;
      cur += ch;
      continue;
    }
    if (ch === "\n" && !inQ) {
      rows.push(splitCsvLine(cur.replace(/\r$/, "")));
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim().length > 0) rows.push(splitCsvLine(cur.replace(/\r$/, "")));
  return rows;
}

function boolFrom(v: string | undefined | null): boolean {
  if (!v) return true;
  const s = v.trim().toLowerCase();
  return s === "t" || s === "true" || s === "1" || s === "sim" || s === "yes";
}

function nz(v: string | undefined | null): string | null {
  if (v === undefined || v === null) return null;
  const t = v.trim();
  return t.length ? t : null;
}

export function parseObrasCsv(text: string): ParseObrasResult {
  const rows = splitCsv(text.replace(/^\uFEFF/, ""));
  const erros: Array<{ linha: number; mensagem: string }> = [];
  if (rows.length === 0) return { rows: [], erros: [{ linha: 0, mensagem: "Arquivo vazio" }] };

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);

  if (idx("codigo") < 0 || idx("nome") < 0) {
    return {
      rows: [],
      erros: [{ linha: 1, mensagem: "Cabeçalho precisa conter ao menos 'codigo' e 'nome'." }],
    };
  }

  const out: ObraImportRow[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.length === 1 && row[0].trim() === "") continue;
    const get = (k: string) => (idx(k) >= 0 ? row[idx(k)] : undefined);
    const codigo = nz(get("codigo"));
    const nome = nz(get("nome"));
    if (!codigo) {
      erros.push({ linha: r + 1, mensagem: "código vazio" });
      continue;
    }
    if (!nome) {
      erros.push({ linha: r + 1, mensagem: "nome vazio" });
      continue;
    }
    out.push({
      codigo,
      nome,
      cliente: nz(get("cliente")),
      status: nz(get("status")),
      ativa: boolFrom(get("ativa")),
      valor_contrato: nz(get("valor_contrato")),
      data_inicio: nz(get("data_inicio")),
      data_previsao_termino: nz(get("data_previsao_termino")),
      data_fim: nz(get("data_fim")),
      local: nz(get("local")),
      pedido_contrato: nz(get("pedido_contrato")),
      centro_custo_totvs: nz(get("centro_custo_totvs")),
      data_mobilizacao: nz(get("data_mobilizacao")),
      data_desmobilizacao: nz(get("data_desmobilizacao")),
    });
  }
  return { rows: out, erros };
}
