/**
 * TST-002 (lote H) — Contrato do repositório DP Holerite (`dpHolerite.ts`).
 * Persistência migrada do Supabase para o MySQL via api.php: o contrato
 * agora fixa rotas, métodos e payloads do apiFetch, além do mapeamento
 * numérico de leitura (mapRow). O antigo `dpRepo` (Supabase, sem
 * consumidores) foi removido junto com a migração.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const apiFetchMock = vi.fn();
vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

import {
  fetchAllHolerites,
  deleteCompetencia,
  fetchLastImport,
  upsertHoleriteBatch,
  mapRow,
} from "@/lib/repositories/dpHolerite";

beforeEach(() => {
  apiFetchMock.mockReset();
});

describe("TST-002.h · dpHolerite — leitura completa/último import", () => {
  it("fetchAllHolerites() consulta a rota dpHolerites e normaliza números", async () => {
    apiFetchMock.mockResolvedValueOnce([
      { id: 1, cpf: "1", competencia: "2026-01", proventos: "100" },
    ]);
    const out = await fetchAllHolerites();

    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).toHaveBeenCalledWith("dpHolerites");
    expect(out[0].proventos).toBe(100);
    expect(out[0].competencia).toBe("2026-01");
  });

  it("fetchAllHolerites() propaga erro", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("db"));
    await expect(fetchAllHolerites()).rejects.toThrow("db");
  });

  it("fetchAllHolerites() devolve [] quando a resposta não é array", async () => {
    apiFetchMock.mockResolvedValueOnce(null);
    const out = await fetchAllHolerites();
    expect(out).toEqual([]);
  });

  it("deleteCompetencia() usa DELETE com param competencia", async () => {
    apiFetchMock.mockResolvedValueOnce({ deleted: 3 });
    await deleteCompetencia("2026-03");
    expect(apiFetchMock).toHaveBeenCalledWith("dpHolerites", {
      method: "DELETE",
      params: { competencia: "2026-03" },
    });
  });

  it("deleteCompetencia() propaga erro", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("del"));
    await expect(deleteCompetencia("x")).rejects.toThrow("del");
  });

  it("fetchLastImport() devolve null quando o backend responde null", async () => {
    apiFetchMock.mockResolvedValueOnce(null);
    const out = await fetchLastImport();
    expect(out).toBeNull();
    expect(apiFetchMock).toHaveBeenCalledWith("dpHolerites", { params: { ultima: "1" } });
  });

  it("fetchLastImport() repassa competencia/count/imported_at do backend", async () => {
    apiFetchMock.mockResolvedValueOnce({
      competencia: "2026-02",
      count: 42,
      imported_at: "2026-03-01 00:00:00",
    });
    const out = await fetchLastImport();
    expect(out).toEqual({
      competencia: "2026-02",
      count: 42,
      imported_at: "2026-03-01 00:00:00",
    });
  });
});

describe("TST-002.h · dpHolerite — upsertHoleriteBatch", () => {
  it("payload vazio: retorna resumo zerado sem chamar a API", async () => {
    const out = await upsertHoleriteBatch([], () => null);
    expect(out).toEqual({
      inserted: 0,
      cpfsNaoCadastrados: [],
      totalLiquido: 0,
      totalCusto: 0,
    });
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("POST dpHolerites com rows mapeadas e coleta cpfs não cadastrados", async () => {
    apiFetchMock.mockResolvedValueOnce({ inserted: 2 });
    const linhas: any[] = [
      {
        tipo: "holerite",
        cpf: "111",
        nome: "Alice",
        competencia: "2026-01",
        matricula: "m1",
        cargo: "c1",
        centroCustoNome: "cc1",
        admissao: "2025-01-01",
        proventos: 1000, descontos: 100, liquido: 900,
        baseInss: 1000, inss: 80,
        baseIrrf: 900, irrf: 10,
        baseFgts: 1000, fgts: 80,
        provisao13: 83, inssProvisao13: 6, fgtsProvisao13: 6,
        provisaoFerias: 111, inssProvisaoFerias: 8, fgtsProvisaoFerias: 8,
        inssEmpresa: 200, rat: 30, inssTerceiros: 58,
        salarioBase: 1000, horasExtras: 0, custoTotal: 1300,
        verbas: [{ codigo: "001", descricao: "SAL", tipo: "P", valor: 1000 }],
      },
      {
        tipo: "adiantamento",
        cpf: "222", nome: "Bob",
        competencia: "2026-01",
        matricula: null, cargo: null, centroCustoNome: null, admissao: null,
        proventos: 500, descontos: 0, liquido: 500,
        baseInss: 0, inss: 0, baseIrrf: 0, irrf: 0,
        baseFgts: 0, fgts: 0,
        provisao13: 0, inssProvisao13: 0, fgtsProvisao13: 0,
        provisaoFerias: 0, inssProvisaoFerias: 0, fgtsProvisaoFerias: 0,
        inssEmpresa: 0, rat: 0, inssTerceiros: 0,
        salarioBase: 0, horasExtras: 0, custoTotal: 500,
        verbas: [],
      },
    ];

    const out = await upsertHoleriteBatch(linhas, (cpf) =>
      cpf === "111" ? "colab-1" : null,
    );

    expect(out.inserted).toBe(2);
    expect(out.cpfsNaoCadastrados).toEqual([{ cpf: "222", nome: "Bob" }]);
    expect(out.totalLiquido).toBe(1400);
    expect(out.totalCusto).toBe(1800);

    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    const [route, opts] = apiFetchMock.mock.calls[0] as [string, any];
    expect(route).toBe("dpHolerites");
    expect(opts.method).toBe("POST");
    const rows = opts.body.rows;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      tipo: "holerite",
      colaborador_id: "colab-1",
      cpf: "111",
      competencia: "2026-01",
      nome_lido: "Alice",
      matricula_lida: "m1",
      cargo_lido: "c1",
      centro_custo_nome_lido: "cc1",
      salario_base: 1000,
      horas_extras_valor: 0,
      origem: "holerite_xls",
    });
    expect(rows[1]).toMatchObject({
      tipo: "adiantamento",
      colaborador_id: null,
      cpf: "222",
      origem: "adiantamento_xls",
    });
    expect(typeof rows[0].imported_at).toBe("string");
  });

  it("propaga erro do POST", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("ups"));
    await expect(
      upsertHoleriteBatch(
        [
          {
            tipo: "holerite", cpf: "1", nome: "n", competencia: "2026-01",
            matricula: null, cargo: null, centroCustoNome: null, admissao: null,
            proventos: 0, descontos: 0, liquido: 0,
            baseInss: 0, inss: 0, baseIrrf: 0, irrf: 0, baseFgts: 0, fgts: 0,
            provisao13: 0, inssProvisao13: 0, fgtsProvisao13: 0,
            provisaoFerias: 0, inssProvisaoFerias: 0, fgtsProvisaoFerias: 0,
            inssEmpresa: 0, rat: 0, inssTerceiros: 0,
            salarioBase: 0, horasExtras: 0, custoTotal: 0, verbas: [],
          } as any,
        ],
        () => "c",
      ),
    ).rejects.toThrow("ups");
  });
});

describe("TST-002.h · dpHolerite.mapRow — normalização numérica", () => {
  it("converte strings numéricas e preserva arrays", () => {
    const row = mapRow({
      id: "r", tipo: null, colaborador_id: null, cpf: "1", competencia: "2026-01",
      nome_lido: null, matricula_lida: null, cargo_lido: null,
      centro_custo_nome_lido: null, admissao: null,
      proventos: "100,5" as any, descontos: "x" as any, liquido: 50,
      base_inss: 0, inss: 0, base_irrf: 0, irrf: 0, base_fgts: 0, fgts: 0,
      provisao_13: 0, inss_provisao_13: 0, fgts_provisao_13: 0,
      provisao_ferias: 0, inss_provisao_ferias: 0, fgts_provisao_ferias: 0,
      inss_empresa: 0, rat: 0, inss_terceiros: 0,
      salario_base: 0, horas_extras_valor: 0, custo_total: 0,
      fator_k: null, verbas: null, imported_at: "t",
    });

    expect(row.tipo).toBe("holerite");
    expect(row.descontos).toBe(0); // NaN -> 0
    expect(row.liquido).toBe(50);
    expect(row.fator_k).toBeNull();
    expect(row.verbas).toEqual([]);
  });

  it("preserva fator_k numérico e verbas quando array", () => {
    const row = mapRow({
      id: "r", tipo: "adiantamento", colaborador_id: "c", cpf: "1",
      competencia: "2026-01", nome_lido: "n", matricula_lida: "m",
      cargo_lido: "c", centro_custo_nome_lido: "cc", admissao: "2025-01-01",
      proventos: 0, descontos: 0, liquido: 0,
      base_inss: 0, inss: 0, base_irrf: 0, irrf: 0, base_fgts: 0, fgts: 0,
      provisao_13: 0, inss_provisao_13: 0, fgts_provisao_13: 0,
      provisao_ferias: 0, inss_provisao_ferias: 0, fgts_provisao_ferias: 0,
      inss_empresa: 0, rat: 0, inss_terceiros: 0,
      salario_base: 0, horas_extras_valor: 0, custo_total: 0,
      fator_k: "1.25" as any,
      verbas: [{ codigo: "1", descricao: "d", tipo: "P", valor: 10 }],
      imported_at: "t",
    });

    expect(row.tipo).toBe("adiantamento");
    expect(row.fator_k).toBe(1.25);
    expect(row.verbas).toHaveLength(1);
  });
});
