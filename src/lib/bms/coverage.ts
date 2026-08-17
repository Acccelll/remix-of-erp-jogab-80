/** @module-kind pure */
// PRO-018 · slice-02 — Métricas de qualidade (coverage) por importação BMS.
// Puro: alimentado apenas pelo `BmsWorkbook` já parseado pela slice-01.
import type { BmsWorkbook } from "@/lib/bms/excel";

/** Chaves obrigatórias do `ColMap` (14 colunas canônicas do layout Jogab). */
const COLUNAS_CANONICAS = [
  "item",
  "desc",
  "qtd",
  "um",
  "preco",
  "total",
  "qa",
  "va",
  "qm",
  "vm",
  "qac",
  "vac",
  "sq",
  "sv",
] as const;

export type BmsCoverageAba = {
  numero: string;
  colunasMapeadas: number;
  colunasTotais: number;
  coverage: number; // 0..1
  itens: number;
};

export type BmsCoverageResumo = {
  abasReconhecidas: number;
  abasIgnoradas: number;
  coverageMedio: number; // 0..1
  itensTotais: number;
  valorTotalMes: number;
  porAba: BmsCoverageAba[];
};

export function bmsCoverage(wb: BmsWorkbook): BmsCoverageResumo {
  const porAba: BmsCoverageAba[] = wb.sheets.map((s) => {
    const colunas = s.diagnostico?.colunas ?? {};
    const mapeadas = COLUNAS_CANONICAS.reduce(
      (acc, k) => acc + (Number.isFinite(colunas[k]) && (colunas[k] as number) >= 0 ? 1 : 0),
      0,
    );
    return {
      numero: s.numero,
      colunasMapeadas: mapeadas,
      colunasTotais: COLUNAS_CANONICAS.length,
      coverage: mapeadas / COLUNAS_CANONICAS.length,
      itens: s.itens.length,
    };
  });

  const somaCoverage = porAba.reduce((a, x) => a + x.coverage, 0);
  const itensTotais = porAba.reduce((a, x) => a + x.itens, 0);
  const valorTotalMes = wb.sheets.reduce((a, s) => a + (s.total_medicao ?? 0), 0);

  return {
    abasReconhecidas: wb.sheets.length,
    abasIgnoradas: wb.ignoradas.length,
    coverageMedio: porAba.length > 0 ? somaCoverage / porAba.length : 0,
    itensTotais,
    valorTotalMes,
    porAba,
  };
}
