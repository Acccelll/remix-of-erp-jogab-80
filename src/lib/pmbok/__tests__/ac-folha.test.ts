import { describe, it, expect } from "vitest";
import { construirAcFolha, mesclarAcFolhaTotvs } from "../ac-folha";

describe("construirAcFolha", () => {
  it("retorna zero quando não há linhas", () => {
    expect(construirAcFolha(null)).toEqual({ porMes: [], total: 0 });
    expect(construirAcFolha([])).toEqual({ porMes: [], total: 0 });
  });

  it("agrupa por mês e soma custo_total", () => {
    const linhas = [
      { centro_custo_id: "01.001", competencia: "2025-01-01", custo_total: 1000 },
      { centro_custo_id: "01.001", competencia: "2025-01-15", custo_total: 500 },
      { centro_custo_id: "01.001", competencia: "2025-02-01", custo_total: 2000 },
    ];
    const result = construirAcFolha(linhas);
    expect(result.porMes).toHaveLength(2);
    expect(result.porMes[0]).toEqual({ mes: "2025-01", valor: 1500 });
    expect(result.porMes[1]).toEqual({ mes: "2025-02", valor: 2000 });
    expect(result.total).toBe(3500);
  });

  it("ordena por mês crescente", () => {
    const linhas = [
      { centro_custo_id: "01.001", competencia: "2025-03", custo_total: 300 },
      { centro_custo_id: "01.001", competencia: "2025-01", custo_total: 100 },
      { centro_custo_id: "01.001", competencia: "2025-02", custo_total: 200 },
    ];
    const { porMes } = construirAcFolha(linhas);
    expect(porMes.map((m) => m.mes)).toEqual(["2025-01", "2025-02", "2025-03"]);
  });
});

describe("mesclarAcFolhaTotvs", () => {
  it("prevalece a folha; TOTVS só preenche meses ausentes", () => {
    const folha = {
      porMes: [
        { mes: "2025-01", valor: 1000 },
        { mes: "2025-03", valor: 3000 },
      ],
      total: 4000,
    };
    const totvs = {
      porMes: [
        { mes: "2025-01", valor: 999 }, // deve ser ignorado (folha tem Jan)
        { mes: "2025-02", valor: 2000 }, // deve entrar (folha não tem Fev)
      ],
      total: 2999,
    };
    const result = mesclarAcFolhaTotvs(folha, totvs);
    expect(result.porMes).toHaveLength(3);
    // Jan vem da folha (1000, não do TOTVS 999)
    expect(result.porMes.find((m) => m.mes === "2025-01")?.valor).toBe(1000);
    // Fev vem do TOTVS
    expect(result.porMes.find((m) => m.mes === "2025-02")?.valor).toBe(2000);
    // Mar vem da folha
    expect(result.porMes.find((m) => m.mes === "2025-03")?.valor).toBe(3000);
    expect(result.total).toBe(6000);
  });

  it("sem dupla contagem quando folha cobre todos os meses", () => {
    const folha = { porMes: [{ mes: "2025-01", valor: 5000 }], total: 5000 };
    const totvs = { porMes: [{ mes: "2025-01", valor: 9999 }], total: 9999 };
    const result = mesclarAcFolhaTotvs(folha, totvs);
    expect(result.total).toBe(5000);
    expect(result.porMes).toHaveLength(1);
  });
});
