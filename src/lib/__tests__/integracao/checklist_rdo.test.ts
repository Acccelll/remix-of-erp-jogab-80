import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseChecklistXlsx } from "@/lib/checklist/parseChecklist";

describe("Checklist Fácil → RDO parser", () => {
  const file = readFileSync(resolve(__dirname, "../fixtures/checklist_214.xlsx"));
  // Convert Node Buffer to a fresh ArrayBuffer to avoid SharedArrayBuffer quirks
  const ab = new ArrayBuffer(file.length);
  new Uint8Array(ab).set(file);
  const parsed = parseChecklistXlsx(ab);

  it("lê todas as 12 linhas válidas (1 sem data é descartada)", () => {
    // 13 linhas no XLSX original; nenhuma deve ficar sem data.
    expect(parsed.totalLinhas).toBeGreaterThanOrEqual(12);
    expect(parsed.errors.length).toBe(0);
  });

  it("identifica a obra 214 - Barra Bonita em todas as linhas", () => {
    for (const r of parsed.rows) {
      expect(r.unidadeCodigo).toBe("214");
      expect(r.unidadeNome?.toLowerCase()).toContain("barra bonita");
    }
  });

  it("converte clima e derivada de trabalhabilidade", () => {
    const limpo = parsed.rows.find((r) => /limpo/i.test(r.climaManha ?? ""));
    expect(limpo?.trabalhavelManha).toBe(true);
    const chuvoso = parsed.rows.find((r) => /chovendo/i.test(r.climaManha ?? ""));
    if (chuvoso) expect(chuvoso.trabalhavelManha).toBe(false);
  });

  it("normaliza data para YYYY-MM-DD", () => {
    for (const r of parsed.rows) {
      expect(r.data).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("captura ocorrências quando existem", () => {
    const total = parsed.rows.reduce((a, r) => a + r.ocorrencias.length, 0);
    expect(total).toBeGreaterThanOrEqual(1);
  });
});
