#!/usr/bin/env node
// ============================================================
// Migração de dados CRM: Supabase → MySQL (jogabcom_gestao_obras)
// ============================================================
// Lê a tabela oportunidade_historico do Supabase (única do CRM que
// recebia escrita remota; tarefas e perdas viviam só em localStorage e
// são reconciliadas automaticamente pelo próprio app) e gera um arquivo
// SQL com INSERTs para executar no MySQL do host, APÓS aplicar a
// migração de schema 2026_07_17_crm_persistencia_mysql.sql.
//
// Uso:
//   node scripts/db/migrar-crm-supabase-mysql.mjs [saida.sql]
//
// Credenciais: VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY do .env
// na raiz (ou variáveis de ambiente). Somente leitura no Supabase.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const OUT = process.argv[2] || "migracao-dados-crm.sql";

function loadEnv() {
  const env = { ...process.env };
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z_]+)="?([^"\n]*)"?\s*$/);
      if (m && !env[m[1]]) env[m[1]] = m[2];
    }
  } catch {
    /* .env opcional */
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY (.env ou ambiente).");
  process.exit(1);
}

async function fetchAll(table) {
  const rows = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
    url.searchParams.set("select", "*");
    url.searchParams.set("order", "created_at.asc");
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Range: `${from}-${from + page - 1}`,
      },
    });
    if (!res.ok) throw new Error(`${table}: HTTP ${res.status} ${await res.text()}`);
    const chunk = await res.json();
    rows.push(...chunk);
    if (chunk.length < page) break;
  }
  return rows;
}

const q = (v) => {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  return `'${String(v).replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
};
const dt = (v) => {
  if (!v) return "NULL";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "NULL";
  return q(d.toISOString().slice(0, 19).replace("T", " "));
};

async function main() {
  const eventos = await fetchAll("oportunidade_historico");
  console.log(`oportunidade_historico: ${eventos.length} linhas`);

  const sql = [];
  sql.push("-- Gerado por scripts/db/migrar-crm-supabase-mysql.mjs em " + new Date().toISOString());
  sql.push("-- Pré-requisito: migração 2026_07_17_crm_persistencia_mysql.sql aplicada.");
  sql.push("SET NAMES utf8mb4;");
  sql.push("START TRANSACTION;");

  for (let i = 0; i < eventos.length; i += 200) {
    const values = eventos.slice(i, i + 200).map((r) => `(${[
      q(r.id),
      q(r.oportunidade_id),
      q(r.tipo || "edicao"),
      q(r.autor_id),
      q(r.autor_login),
      q(r.descricao || ""),
      r.detalhes != null ? q(JSON.stringify(r.detalhes)) : "NULL",
      dt(r.created_at),
    ].join(",")})`);
    // INSERT IGNORE: ids são uuid — reexecutar o arquivo não duplica.
    sql.push(
      "INSERT IGNORE INTO oportunidade_historico (id, oportunidade_id, tipo, autor_id, autor_login, descricao, detalhes, ocorrido_em) VALUES\n" +
      values.join(",\n") + ";",
    );
  }

  sql.push("COMMIT;");
  writeFileSync(OUT, sql.join("\n\n") + "\n");
  console.log(`\nOK — SQL gravado em ${OUT}`);
  console.log("Execute no MySQL do host APÓS a migração de schema. O script não altera o Supabase.");
}

main().catch((e) => {
  console.error("Falha:", e.message || e);
  process.exit(1);
});
