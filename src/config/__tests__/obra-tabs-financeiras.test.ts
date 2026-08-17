// As abas de medição/faturamento da obra exigem o módulo Financeiro. Antes
// exibiam medições e notas fiscais a quem tinha apenas obras_div — e o gate por
// módulo do api.php aceitava obras_div nas rotas correspondentes.
import { describe, expect, it } from "vitest";
import {
  OBRA_TAB_ITEMS,
  OBRA_TAB_SECTIONS,
  OBRA_TABS_FINANCEIRAS,
} from "@/config/obra-tabs";

describe("abas financeiras da obra", () => {
  it("toda a seção Medição & Faturamento exige Financeiro", () => {
    const secao = OBRA_TAB_SECTIONS.find((s) => s.label === "Medição & Faturamento");
    expect(secao).toBeDefined();
    const desprotegidas = secao!.items.filter((i) => !i.requerFinanceiro);
    expect(desprotegidas.map((i) => i.value)).toEqual([]);
  });

  it("as abas de análise que leem medições/BMs também exigem", () => {
    for (const v of ["previsao", "analise", "desempenho"]) {
      expect(OBRA_TABS_FINANCEIRAS.has(v)).toBe(true);
    }
  });

  it("abas não-financeiras seguem livres", () => {
    for (const v of ["resumo", "cronograma", "aditivos", "riscos", "ocorrencias", "historico"]) {
      expect(OBRA_TABS_FINANCEIRAS.has(v)).toBe(false);
    }
  });

  it("OBRA_TABS_FINANCEIRAS espelha exatamente o marcador requerFinanceiro", () => {
    const marcadas = OBRA_TAB_ITEMS.filter((i) => i.requerFinanceiro).map((i) => i.value).sort();
    expect([...OBRA_TABS_FINANCEIRAS].sort()).toEqual(marcadas);
  });
});
