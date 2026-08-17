#!/usr/bin/env node
// scripts/sec002/validate-dri-matrix.mjs
// Validador determinístico do registro DRI (SEC-002 / PC6 / R122).
// ESM puro. Read-only. Sem dependências externas.
// Regras D1–D10 compatíveis com R49.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { loadApplyMap } from "./load-apply-map.mjs";

const REQUIRED_ROLES = [
  "dri_technical",
  "dri_platform",
  "dri_tests",
  "dri_observability",
  "dri_security",
  "comms_owner",
  "incident_commander",
  "gm_approver",
];

function fail(code, message, context = {}) {
  process.stderr.write(
    JSON.stringify({ ok: false, code, message, context }, null, 2) + "\n"
  );
  process.exit(code.startsWith("E_DRI_OP") ? 2 : 1);
}

function parseArgs(argv) {
  const out = { applyId: null, file: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--apply-id") out.applyId = argv[++i];
    else if (a.startsWith("--apply-id=")) out.applyId = a.slice("--apply-id=".length);
    else if (a === "--file") out.file = argv[++i];
    else if (a.startsWith("--file=")) out.file = a.slice("--file=".length);
    else fail("E_DRI_ARGS", `flag desconhecida: ${a}`, { arg: a });
  }
  if (!out.applyId) fail("E_DRI_ARGS", "--apply-id obrigatório");
  if (!out.file) out.file = `.github/sec002-dri/${out.applyId}.md`;
  return out;
}

// Parser YAML mínimo — suporta escalares e mapas aninhados por indentação de 2 espaços.
function parseFrontmatter(raw) {
  const m = /^---\s*\n([\s\S]*?)\n---\s*\n?/m.exec(raw);
  if (!m) fail("D1_FRONTMATTER", "frontmatter YAML ausente");
  const lines = m[1].split("\n");
  const root = {};
  const stack = [{ indent: -1, obj: root }];
  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const indent = line.match(/^ */)[0].length;
    const content = line.slice(indent);
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();
    const parent = stack[stack.length - 1].obj;
    const kv = /^([A-Za-z0-9_]+)\s*:\s*(.*)$/.exec(content);
    if (!kv) continue;
    const key = kv[1];
    const val = kv[2];
    if (val === "" || val === null) {
      const child = {};
      parent[key] = child;
      stack.push({ indent, obj: child });
    } else {
      let v = val.trim();
      if (v === "true") v = true;
      else if (v === "false") v = false;
      else if (v === "null") v = null;
      parent[key] = v;
    }
  }
  return root;
}

function hasPlaceholder(v) {
  if (typeof v !== "string") return false;
  return /\bTBD\b|\bTODO\b|\bXXX\b|<[^>]+>|\{\{|\}\}/i.test(v);
}

function main() {
  const { applyId, file } = parseArgs(process.argv.slice(2));
  const abs = resolve(process.cwd(), file);
  if (!existsSync(abs)) fail("D2_MISSING", `registro DRI ausente: ${file}`, { file });

  let raw;
  try {
    raw = readFileSync(abs, "utf8");
  } catch (e) {
    fail("E_DRI_OP_READ", `falha de leitura: ${file}`, { error: String(e?.message ?? e) });
  }

  const fm = parseFrontmatter(raw);

  // D3 — apply_id
  if (fm.sec002_apply_id !== applyId) {
    fail("D3_APPLY_ID", "sec002_apply_id divergente", {
      expected: applyId,
      actual: fm.sec002_apply_id ?? null,
    });
  }

  // D4 — matrix_version
  if (typeof fm.matrix_version !== "string" || !/^v\d{4}-\d{2}-\d{2}\.\d+$/.test(fm.matrix_version)) {
    fail("D4_MATRIX_VERSION", "matrix_version ausente/inválida", { actual: fm.matrix_version ?? null });
  }

  // D5 — papéis obrigatórios com primary não-placeholder
  const roles = fm.roles ?? {};
  for (const r of REQUIRED_ROLES) {
    const node = roles[r];
    if (!node || typeof node !== "object") fail("D5_ROLE_MISSING", `papel ausente: ${r}`, { role: r });
    if (!node.primary || hasPlaceholder(node.primary)) {
      fail("D5_ROLE_PRIMARY", `primary inválido para ${r}`, { role: r, primary: node.primary ?? null });
    }
  }

  // D6 — segregação GM ≠ DRI técnico
  const gm = roles.gm_approver?.primary;
  const tech = roles.dri_technical?.primary;
  if (gm !== "Cappucceno") fail("D6_GM", "gm_approver.primary deve ser Cappucceno", { actual: gm ?? null });
  if (!tech || tech === "Cappucceno") {
    fail("D6_SEG", "dri_technical.primary ausente ou igual ao GM", { tech: tech ?? null });
  }

  // D7 — aprovações
  const approved = fm.approved_by ?? {};
  if (approved.gm !== "Cappucceno") fail("D7_APPROVED_GM", "approved_by.gm deve ser Cappucceno");
  if (!approved.dri_technical || approved.dri_technical === "Cappucceno") {
    fail("D7_APPROVED_TECH", "approved_by.dri_technical ausente ou igual ao GM");
  }

  // D8 — janela
  const w = fm.window ?? {};
  if (!w.starts_at || !w.ends_at) fail("D8_WINDOW", "window.starts_at/ends_at obrigatórios");
  if (isNaN(Date.parse(w.starts_at)) || isNaN(Date.parse(w.ends_at))) {
    fail("D8_WINDOW_ISO", "window com ISO-8601 inválido", { window: w });
  }
  if (Date.parse(w.ends_at) <= Date.parse(w.starts_at)) {
    fail("D8_WINDOW_ORDER", "window.ends_at deve ser posterior a starts_at");
  }

  // D9 — evidence_refs presentes (strings não vazias)
  const refs = fm.evidence_refs ?? {};
  for (const k of ["go_no_go", "comms", "acceptance"]) {
    if (!refs[k] || typeof refs[k] !== "string") {
      fail("D9_REFS", `evidence_refs.${k} ausente/ inválido`, { key: k, value: refs[k] ?? null });
    }
  }

  // D10 — corpo do documento com marcadores canônicos
  if (!/DRI\s+GM:\s*Cappucceno\b/.test(raw)) fail("D10_BODY_GM", "corpo deve conter 'DRI GM: Cappucceno'");
  if (!/DRI\s+técnico:\s*\S+/i.test(raw)) fail("D10_BODY_TECH", "corpo deve conter 'DRI técnico: <nome>'");

  // Modo soft-null: apply-map ausente é operacional-not-blocking para abertura formal.
  try {
    loadApplyMap();
  } catch (e) {
    // erros de apply-map não bloqueiam validação documental de PC6
  }

  process.stdout.write(
    `[sec002/validate-dri-matrix] OK apply_id=${applyId} file=${file}\n`
  );
  process.exit(0);
}

try {
  main();
} catch (e) {
  fail("E_DRI_OP", String(e?.message ?? e), { stack: String(e?.stack ?? "") });
}
