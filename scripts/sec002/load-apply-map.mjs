// scripts/sec002/load-apply-map.mjs
// Loader determinístico do apply-map v2026-07-12.4 (SEC-002 / PC3 / R111).
// ESM puro. Read-only. Sem dependências externas.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

export const SCHEMA_VERSION = "v2026-07-12.4";
export const APPLY_MAP_PATH = ".github/sec002-apply-map.json";

function fail(code, message, context = {}) {
  const err = new Error(message);
  err.code = code;
  err.context = context;
  return err;
}

export function loadApplyMap(root = process.cwd()) {
  const abs = resolve(root, APPLY_MAP_PATH);
  let raw;
  try {
    raw = readFileSync(abs, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      // Modo soft: apply-map ainda não bootstrapped. Verificador PC3 usa
      // fallback loader.SCHEMA_VERSION quando o retorno é null.
      return null;
    }
    throw fail("E_APPLY_MAP_UNREADABLE", `apply-map ilegível: ${APPLY_MAP_PATH}`, {
      path: APPLY_MAP_PATH,
      error: String(error?.message ?? error),
    });
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    throw fail("E_APPLY_MAP_JSON", `apply-map JSON inválido: ${APPLY_MAP_PATH}`, {
      path: APPLY_MAP_PATH,
      error: String(error?.message ?? error),
    });
  }

  if (data?.schema_version !== SCHEMA_VERSION) {
    throw fail("E_APPLY_MAP_SCHEMA", `apply-map schema_version inesperado`, {
      path: APPLY_MAP_PATH,
      expected: SCHEMA_VERSION,
      actual: data?.schema_version ?? null,
    });
  }

  return Object.freeze(data);
}

export default loadApplyMap;
