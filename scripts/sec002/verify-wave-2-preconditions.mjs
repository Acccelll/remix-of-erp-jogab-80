#!/usr/bin/env node
// Verificador determinístico de PC1–PC7 para abertura formal da Onda 2 (SEC-002/R97).

import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const SCHEMA_VERSION = "v2026-07-12.4";
const DEFAULT_APPLY_ID = "wave-2-formal-open-01";
const EXPECTED_INDEX_ROWS = 45;
const ROOT = process.cwd();

const PC_CODES = {
  PC1: "E_WAVE2_PC1",
  PC2: "E_WAVE2_PC2",
  PC3: "E_WAVE2_PC3",
  PC4: "E_WAVE2_PC4",
  PC5: "E_WAVE2_PC5",
  PC6: "E_WAVE2_PC6",
  PC7: "E_WAVE2_PC7",
};

function parseArgs(argv) {
  const out = {
    applyId: DEFAULT_APPLY_ID,
    json: false,
    dryRun: false,
    only: null,
  };

  for (const arg of argv) {
    if (arg === "--json") out.json = true;
    else if (arg === "--dry-run") out.dryRun = true;
    else if (arg.startsWith("--apply-id=")) out.applyId = arg.slice("--apply-id=".length);
    else if (arg.startsWith("--only=")) out.only = arg.slice("--only=".length).split(",").map((pc) => pc.trim()).filter(Boolean);
    else throw failure("E_WAVE2_ARGS", `flag desconhecida: ${arg}`, { arg });
  }

  if (out.applyId !== DEFAULT_APPLY_ID) {
    throw failure("E_WAVE2_ARGS", `apply-id inválido: ${out.applyId}`, { expected: DEFAULT_APPLY_ID });
  }
  if (out.only && !out.dryRun) {
    throw failure("E_WAVE2_ARGS", "--only só é permitido junto com --dry-run", { only: out.only });
  }
  if (out.only) {
    const invalid = out.only.filter((pc) => !PC_CODES[pc]);
    if (invalid.length) throw failure("E_WAVE2_ARGS", `PC inválida em --only: ${invalid.join(",")}`, { invalid });
  }

  return out;
}

function failure(code, message, context = {}) {
  const err = new Error(message);
  err.code = code;
  err.context = context;
  return err;
}

function pathOf(relativePath) {
  return resolve(ROOT, relativePath);
}

function readText(relativePath, pc, message = "arquivo ausente") {
  const abs = pathOf(relativePath);
  if (!existsSync(abs)) throw failure(PC_CODES[pc], `${message}: ${relativePath}`, { path: relativePath });
  return readFileSync(abs, "utf8");
}

function extractMarkdownSection(raw, headingPattern) {
  const lines = raw.split(/\r?\n/);
  const start = lines.findIndex((line) => headingPattern.test(line.trim()));
  if (start < 0) return "";
  const level = /^#+/.exec(lines[start].trim())?.[0].length ?? 2;
  const end = lines.findIndex((line, idx) => idx > start && /^#+\s+/.test(line.trim()) && ((/^#+/.exec(line.trim())?.[0].length ?? 0) <= level));
  return lines.slice(start, end < 0 ? undefined : end).join("\n");
}

function requireMatch(pc, text, regex, message, context = {}) {
  if (!regex.test(text)) throw failure(PC_CODES[pc], message, context);
}

function parseFrontmatter(raw, pc, file) {
  if (!raw.startsWith("---\n")) throw failure(PC_CODES[pc], `frontmatter ausente: ${file}`, { path: file });
  const end = raw.indexOf("\n---", 4);
  if (end < 0) throw failure(PC_CODES[pc], `frontmatter sem fechamento: ${file}`, { path: file });
  const body = raw.slice(4, end).split(/\r?\n/);
  const data = {};
  const stack = [];

  for (const line of body) {
    if (!line.trim()) continue;
    const match = /^(\s*)([^:]+):(?:\s*(.*))?$/.exec(line);
    if (!match) continue;
    const indent = match[1].length;
    const key = match[2].trim();
    const value = (match[3] ?? "").trim();
    const depth = Math.floor(indent / 2);
    stack.length = depth;
    const targetPath = [...stack, key];
    setNested(data, targetPath, value === "" ? {} : value);
    if (value === "") stack[depth] = key;
  }
  return data;
}

function setNested(root, path, value) {
  let node = root;
  for (let i = 0; i < path.length - 1; i += 1) {
    node[path[i]] ??= {};
    node = node[path[i]];
  }
  node[path[path.length - 1]] = value;
}

function parseJsonFile(relativePath, pc) {
  const raw = readText(relativePath, pc);
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw failure(PC_CODES[pc], `JSON inválido: ${relativePath}`, { path: relativePath, error: String(error.message ?? error) });
  }
}

function isoDateValue(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)?$/.test(value.trim());
}

function verifyPC1() {
  const file = "docs/modernizacao/EXECUCAO/06_CHANGESETS/SEC-001.README.md";
  const raw = readText(file, "PC1");
  const section = extractMarkdownSection(raw, /^##\s+(?:\d+\.\s*)?Status formal\b/i);
  if (!section) throw failure(PC_CODES.PC1, "bloco Status formal ausente", { path: file });
  requireMatch("PC1", section, /Status:\s*CLOSED\b/i, "SEC-001 ainda não está em Status: CLOSED", { path: file });
  requireMatch("PC1", section, /Data:\s*\d{4}-\d{2}-\d{2}/i, "Status formal sem Data ISO", { path: file });
  requireMatch("PC1", section, /DRI\s+GM:\s*Cappucceno\b/i, "Status formal sem DRI GM: Cappucceno", { path: file });
}

function verifyPC2() {
  const file = ".github/sec002-readiness/wave-2.md";
  const raw = readText(file, "PC2");
  const frontmatter = parseFrontmatter(raw, "PC2", file);
  if (frontmatter.status !== "OPEN") throw failure(PC_CODES.PC2, `Status diferente de OPEN: ${frontmatter.status ?? "<ausente>"}`, { path: file });
  for (let i = 1; i <= 12; i += 1) {
    if (!new RegExp(`\\bO2-P${i}:`).test(raw)) throw failure(PC_CODES.PC2, `precondição O2-P${i} ausente`, { path: file });
  }

  const formalOpen = extractMarkdownSection(raw, /^##\s+(?:\d+\.\s*)?Abertura formal\b/i);
  if (!formalOpen) throw failure(PC_CODES.PC2, "bloco Abertura formal ausente", { path: file });
  requireMatch("PC2", formalOpen, /Status atual:\s*OPEN\b/i, "Abertura formal sem Status atual: OPEN", { path: file });
  requireMatch("PC2", formalOpen, /Apply-id:\s*wave-2-formal-open-01\b/i, "Abertura formal sem apply-id canônico", { path: file });
  requireMatch("PC2", formalOpen, /Pré-condições verificadas:\s*PC1,\s*PC2,\s*PC3,\s*PC4,\s*PC5,\s*PC6,\s*PC7\b/i, "Abertura formal sem PC1..PC7 verificados", { path: file });
}

async function verifyPC3() {
  const loaderPath = "scripts/sec002/load-apply-map.mjs";
  if (!existsSync(pathOf(loaderPath))) throw failure(PC_CODES.PC3, `loader ausente: ${loaderPath}`, { path: loaderPath });

  const loader = await import(`${pathOf(loaderPath)}?t=${Date.now()}`);
  const map = typeof loader.loadApplyMap === "function"
    ? loader.loadApplyMap()
    : typeof loader.getApplyMap === "function"
      ? loader.getApplyMap()
      : loader.default && typeof loader.default === "function"
        ? loader.default()
        : null;

  const version = map?.schema_version ?? map?.schemaVersion ?? loader.SCHEMA_VERSION ?? loader.schemaVersion;
  if (version !== SCHEMA_VERSION) throw failure(PC_CODES.PC3, `apply-map diferente de ${SCHEMA_VERSION}: ${version ?? "<indisponível>"}`, { path: loaderPath });

  const readme = readText("docs/modernizacao/EXECUCAO/06_CHANGESETS/SEC-001.README.md", "PC3");
  const bumps = [...readme.matchAll(/SEC-002\.apply-map-01\.[^`|\n]*(spec|materialize)-01\.md/g)].map((m) => m[0]);
  const stems = new Map();
  for (const name of bumps) {
    const stem = name.replace(/\.(spec|materialize)-01\.md$/, "");
    const set = stems.get(stem) ?? new Set();
    set.add(name.includes(".spec-01.md") ? "spec" : "materialize");
    stems.set(stem, set);
  }
  for (const [stem, set] of stems) {
    if (set.size === 1) throw failure(PC_CODES.PC3, `bump de apply-map sem par spec/materialize: ${stem}`, { stem });
  }
}

function verifyPC4() {
  const file = ".github/sec002-evidence/INDEX.md";
  const raw = readText(file, "PC4");
  requireMatch("PC4", raw, new RegExp(SCHEMA_VERSION.replace(/[.]/g, "\\.")), `INDEX.md sem schema ${SCHEMA_VERSION}`, { path: file });

  const rows = raw.split(/\r?\n/).filter((line) => /^\|\s*\d+\s*\|/.test(line.trim()));
  if (rows.length !== EXPECTED_INDEX_ROWS) {
    throw failure(
      PC_CODES.PC4,
      `INDEX.md deve ter ${EXPECTED_INDEX_ROWS} linhas úteis; encontrado ${rows.length}`,
      { path: file, rows: rows.length, expected: EXPECTED_INDEX_ROWS },
    );
  }
  for (let i = 1; i <= EXPECTED_INDEX_ROWS; i += 1) {
    if (!rows.some((line) => new RegExp(`^\\|\\s*${i}\\s*\\|`).test(line.trim()))) {
      throw failure(PC_CODES.PC4, `linha útil ${i} ausente em INDEX.md`, { path: file, line: i });
    }
  }
}

function verifyPC5() {
  const file = ".github/sec002-guards-status.json";
  const data = parseJsonFile(file, "PC5");
  if (!data.last_green_sha || !data.last_green_run_url) {
    throw failure(PC_CODES.PC5, "guards-status sem last_green_sha ou last_green_run_url", { path: file });
  }
  const rawDate = data.last_green_at ?? data.generated_at ?? data.evaluated_at;
  if (!rawDate || Number.isNaN(Date.parse(rawDate))) throw failure(PC_CODES.PC5, "guards-status sem data verde válida", { path: file });
  const ageMs = Date.now() - Date.parse(rawDate);
  if (ageMs < 0 || ageMs > 7 * 24 * 60 * 60 * 1000) throw failure(PC_CODES.PC5, "guards-status datado há mais de 7 dias", { path: file, date: rawDate });
}

async function verifyPC6() {
  const file = `.github/sec002-dri/${DEFAULT_APPLY_ID}.md`;
  const raw = readText(file, "PC6");
  requireMatch("PC6", raw, /DRI\s+GM:\s*Cappucceno\b|gm_approver:\s*[\s\S]*?primary:\s*Cappucceno\b/i, "DRI GM Cappucceno ausente", { path: file });
  const tech = /DRI\s+t[eé]cnico:\s*([^\n]+)/i.exec(raw)?.[1]?.trim()
    ?? /dri_technical:\s*[\s\S]*?primary:\s*([^\n]+)/i.exec(raw)?.[1]?.trim();
  if (!tech || /^Cappucceno$/i.test(tech)) throw failure(PC_CODES.PC6, "DRI técnico ausente ou igual ao GM", { path: file, driTechnical: tech ?? null });

  const validatorPath = "scripts/sec002/validate-dri-matrix.mjs";
  if (!existsSync(pathOf(validatorPath))) throw failure(PC_CODES.PC6, `validador DRI ausente: ${validatorPath}`, { path: validatorPath });
}

function verifyPC7() {
  const file = `.github/sec002-decisions/${DEFAULT_APPLY_ID}.md`;
  const raw = readText(file, "PC7");
  requireMatch("PC7", raw, /Autor:\s*\S+/i, "decisão sem Autor", { path: file });
  const date = /Data:\s*([^\n]+)/i.exec(raw)?.[1]?.trim();
  if (!isoDateValue(date)) throw failure(PC_CODES.PC7, "decisão sem Data ISO-8601 UTC", { path: file, date: date ?? null });
  const justification = extractMarkdownSection(raw, /^##\s+(?:\d+\.\s*)?Justificativa\b/i);
  const lines = justification.split(/\r?\n/).filter((line) => line.trim() && !/^##/.test(line.trim()));
  if (lines.length < 3) throw failure(PC_CODES.PC7, "justificativa deve ter pelo menos 3 linhas", { path: file, lines: lines.length });
}

const CHECKS = {
  PC1: verifyPC1,
  PC2: verifyPC2,
  PC3: verifyPC3,
  PC4: verifyPC4,
  PC5: verifyPC5,
  PC6: verifyPC6,
  PC7: verifyPC7,
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const selected = args.only ?? Object.keys(CHECKS);
  const passed = [];

  for (const pc of selected) {
    await CHECKS[pc]();
    passed.push(pc);
  }

  if (args.json) {
    console.log(JSON.stringify({ ok: true, schema_version: SCHEMA_VERSION, apply_id: args.applyId, checked: passed }, null, 2));
  } else {
    console.log(`OK verify-wave-2-preconditions ${SCHEMA_VERSION} PC1..PC7`);
  }
}

try {
  await main();
} catch (error) {
  const code = error.code ?? "E_WAVE2_UNKNOWN";
  const message = error.message ?? String(error);
  const context = error.context ?? {};
  if (process.argv.includes("--json")) {
    console.error(JSON.stringify({ ok: false, code, message, context }, null, 2));
  } else {
    console.error(`FAIL ${code} ${message}`);
    if (Object.keys(context).length) console.error(JSON.stringify(context, null, 2));
  }
  process.exit(1);
}