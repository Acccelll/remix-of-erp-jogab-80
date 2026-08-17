import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * PRO-031.slice-21 — Auditoria estática:
 * Todos os pontos de criação dos documentos com numeração parametrizada
 * DEVEM emitir número via `emitirNumeroCustomizado` (ou usar o hook dedicado)
 * na mesma unidade de código, evitando regressões silenciosas.
 *
 * Regra: cada arquivo listado precisa referenciar `emitirNumeroCustomizado`
 * OU um hook equivalente já auditado (`useRdoNumeracaoLocal`).
 */
const CALLERS: Array<{ file: string; allow?: RegExp[] }> = [
  { file: "src/contexts/contratos/ContratosStateContext.tsx" },
  { file: "src/pages/suprimentos/Cotacoes.tsx" },
  { file: "src/pages/suprimentos/OrdensCompra.tsx" },
  { file: "src/pages/suprimentos/Requisicoes.tsx" },
  { file: "src/components/obra-detalhe/MedicoesTab.tsx" },
  { file: "src/components/obra-detalhe/NfsTab.tsx" },
];

describe("PRO-031 · auditoria de callers de numeração customizada", () => {
  for (const { file, allow } of CALLERS) {
    it(`${file} emite número parametrizado`, () => {
      const src = readFileSync(resolve(process.cwd(), file), "utf8");
      const emits =
        src.includes("emitirNumeroCustomizado") ||
        (allow ?? []).some((rx) => rx.test(src));
      expect(emits, `${file} deve emitir número via emitirNumeroCustomizado`).toBe(true);
    });
  }
});
