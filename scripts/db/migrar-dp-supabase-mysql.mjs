#!/usr/bin/env node
// ============================================================
// Migração de dados DP: Supabase → MySQL (jogabcom_gestao_obras)
// ============================================================
// Lê dp_holerite, dp_fechamento_competencia, ponto_importacoes e
// ponto_registros do Supabase (REST) e gera um arquivo SQL com INSERTs
// para executar no MySQL do host (phpMyAdmin ou CLI), APÓS aplicar a
// migração de schema 2026_07_17_dp_persistencia_mysql.sql.
//
// Uso:
//   node scripts/db/migrar-dp-supabase-mysql.mjs [saida.sql]
//
// Credenciais: usa VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY do
// .env na raiz (ou variáveis de ambiente com os mesmos nomes).
// O script é somente leitura no Supabase; nada é apagado.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const OUT = process.argv[2] || "migracao-dados-dp.sql";

function loadEnv() {
  const env = { ...process.env };
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z_]+)="?([^"\n]*)"?\s*$/);
      if (m && !env[m[1]]) env[m[1]] = m[2];
    }
  } catch {
    /* .env opcional quando as variáveis já estão no ambiente */
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

async function fetchAll(table, select = "*", order = null) {
  const rows = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
    url.searchParams.set("select", select);
    if (order) url.searchParams.set("order", order);
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

// ── Helpers SQL ──
const q = (v) => {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (typeof v === "boolean") return v ? "1" : "0";
  return `'${String(v).replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
};
const dt = (v) => {
  if (!v) return "NULL";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "NULL";
  return q(d.toISOString().slice(0, 19).replace("T", " "));
};
const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const NUM_HOL = [
  "proventos","descontos","liquido","base_inss","inss","base_irrf","irrf","base_fgts","fgts",
  "provisao_13","inss_provisao_13","fgts_provisao_13","provisao_ferias","inss_provisao_ferias",
  "fgts_provisao_ferias","inss_empresa","rat","inss_terceiros","salario_base","horas_extras_valor",
];

async function main() {
  const sql = [];
  sql.push("-- Gerado por scripts/db/migrar-dp-supabase-mysql.mjs em " + new Date().toISOString());
  sql.push("-- Pré-requisito: migração 2026_07_17_dp_persistencia_mysql.sql aplicada.");
  sql.push("SET NAMES utf8mb4;");
  sql.push("START TRANSACTION;");

  // ── dp_holerite (idempotente pela chave cpf+competencia+tipo) ──
  const hol = await fetchAll("dp_holerite");
  console.log(`dp_holerite: ${hol.length} linhas`);
  const holCols = [
    "tipo","colaborador_id","cpf","competencia","nome_lido","matricula_lida","cargo_lido",
    "centro_custo_nome_lido","admissao", ...NUM_HOL, "custo_total","fator_k","verbas","origem","imported_at",
  ];
  for (const grupo of chunk(hol, 200)) {
    const values = grupo.map((r) => {
      const nums = NUM_HOL.map((f) => q(Number(r[f]) || 0));
      const custo = ["proventos","inss_empresa","rat","inss_terceiros","fgts","provisao_13","provisao_ferias"]
        .reduce((s, f) => s + (Number(r[f]) || 0), 0);
      const salario = Number(r.salario_base) || 0;
      return `(${[
        q(r.tipo || "holerite"), q(r.colaborador_id), q(r.cpf), q(r.competencia), q(r.nome_lido),
        q(r.matricula_lida), q(r.cargo_lido), q(r.centro_custo_nome_lido),
        r.admissao ? q(String(r.admissao).slice(0, 10)) : "NULL",
        ...nums,
        q(custo), salario > 0 ? q(custo / salario) : "NULL",
        q(JSON.stringify(Array.isArray(r.verbas) ? r.verbas : [])),
        q(r.origem || "holerite_xls"), dt(r.imported_at),
      ].join(",")})`;
    });
    sql.push(
      `INSERT INTO dp_holerite (${holCols.join(",")}) VALUES\n${values.join(",\n")}\n` +
      `ON DUPLICATE KEY UPDATE imported_at = VALUES(imported_at);`,
    );
  }

  // ── dp_fechamento_competencia (histórico completo, com reaberturas) ──
  const fech = await fetchAll("dp_fechamento_competencia", "*", "fechado_em.asc");
  console.log(`dp_fechamento_competencia: ${fech.length} linhas`);
  for (const r of fech) {
    sql.push(
      `INSERT INTO dp_fechamento_competencia (competencia, fechado_em, fechado_por, motivo, reaberto_em, reaberto_por, motivo_reabertura) VALUES (` +
      [q(r.competencia), dt(r.fechado_em), q(r.fechado_por), q(r.motivo), dt(r.reaberto_em), q(r.reaberto_por), q(r.motivo_reabertura)].join(",") +
      `);`,
    );
  }

  // ── ponto: importações + registros (remapeia uuid → AUTO_INCREMENT) ──
  const imps = await fetchAll("ponto_importacoes", "*", "importado_em.asc");
  const regs = await fetchAll("ponto_registros");
  console.log(`ponto_importacoes: ${imps.length} | ponto_registros: ${regs.length}`);
  const regsByImp = new Map();
  for (const r of regs) {
    if (!regsByImp.has(r.importacao_id)) regsByImp.set(r.importacao_id, []);
    regsByImp.get(r.importacao_id).push(r);
  }
  const regCols = [
    "importacao_id","colaborador_id","nome_csv","matricula_csv","cpf_csv","departamento_csv","obra_id",
    "centro_indireto","agregado","data","horas_previstas_min","horas_trabalhadas_min","horas_falta_min",
    "dias_falta_qtd","horas_extra_50_min","horas_extra_60_min","horas_extra_100_min",
    "horas_compensadas_min","interjornada_min","banco_saldo_min","marcacao_invalida","falta","atestado","observacao",
  ];
  for (const imp of imps) {
    sql.push(
      `INSERT INTO ponto_importacoes (arquivo_nome, periodo_inicio, periodo_fim, total_registros, total_colaboradores, importado_por, importado_em) VALUES (` +
      [q(imp.arquivo_nome), q(imp.periodo_inicio), q(imp.periodo_fim), q(imp.total_registros || 0),
       q(imp.total_colaboradores || 0), q(imp.importado_por), dt(imp.importado_em || imp.created_at)].join(",") +
      `);`,
    );
    sql.push("SET @imp_id = LAST_INSERT_ID();");
    const doImp = regsByImp.get(imp.id) || [];
    for (const grupo of chunk(doImp, 200)) {
      const values = grupo.map((r) => `(${[
        "@imp_id", q(r.colaborador_id), q(r.nome_csv || ""), q(r.matricula_csv), q(r.cpf_csv),
        q(r.departamento_csv), q(r.obra_id), q(!!r.centro_indireto), q(!!r.agregado), q(r.data),
        q(r.horas_previstas_min || 0), q(r.horas_trabalhadas_min || 0), q(r.horas_falta_min || 0),
        q(r.dias_falta_qtd || 0), q(r.horas_extra_50_min || 0), q(r.horas_extra_60_min || 0),
        q(r.horas_extra_100_min || 0), q(r.horas_compensadas_min || 0), q(r.interjornada_min || 0),
        q(r.banco_saldo_min || 0), q(!!r.marcacao_invalida), q(!!r.falta), q(!!r.atestado), q(r.observacao),
      ].join(",")})`);
      sql.push(`INSERT INTO ponto_registros (${regCols.join(",")}) VALUES\n${values.join(",\n")};`);
    }
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
