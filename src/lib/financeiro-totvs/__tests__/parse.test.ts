import { describe, expect, it } from "vitest";
import {
  parseMatriz,
  parseLancamentos,
  parseRateios,
  reconciliarRateios,
  toIsoDate,
  toMoney,
} from "../parse";

describe("toMoney", () => {
  it("parses números diretos", () => {
    expect(toMoney(1234.56)).toBe(1234.56);
  });
  it("parses formato BR com R$ e vírgula", () => {
    expect(toMoney("R$ 1.234,56")).toBe(1234.56);
    expect(toMoney("1.234,56")).toBe(1234.56);
  });
  it("retorna 0 para vazio/inválido", () => {
    expect(toMoney("")).toBe(0);
    expect(toMoney(null)).toBe(0);
    expect(toMoney("abc")).toBe(0);
  });
});

describe("toIsoDate", () => {
  it("converte dd/mm/yyyy → ISO", () => {
    expect(toIsoDate("15/03/2025")).toBe("2025-03-15");
  });
  it("preserva ISO yyyy-mm-dd", () => {
    expect(toIsoDate("2025-03-15")).toBe("2025-03-15");
  });
  it("converte Date instance", () => {
    expect(toIsoDate(new Date("2025-03-15T12:00:00Z"))).toBe("2025-03-15");
  });
  it("retorna null para vazio/inválido", () => {
    expect(toIsoDate("")).toBeNull();
    expect(toIsoDate(null)).toBeNull();
  });
});

describe("parseLancamentos", () => {
  it("mapeia colunas principais", () => {
    const rows = [
      {
        "Ref. Lançamento": 1001,
        "Imagem - Natureza": 2,
        "Imagem - Status": 3,
        Filial: 1,
        "Tipo de Documento": "NF",
        "Centro de Custo": "01.002.0202",
        "Valor líquido": "1.234,56",
        "Data de Emissão": "15/03/2025",
        Histórico: "compra",
      },
    ];
    const r = parseLancamentos(rows);
    expect(r).toHaveLength(1);
    expect(r[0].ref_lancamento).toBe(1001);
    expect(r[0].natureza_tipo).toBe(2);
    expect(r[0].status_cod).toBe(3);
    expect(r[0].status_label).toBe("Baixado");
    expect(r[0].centro_custo).toBe("01.002.0202");
    expect(r[0].valor_liquido).toBe(1234.56);
    expect(r[0].data_emissao).toBe("2025-03-15");
  });
  it("ignora linhas sem ref_lancamento", () => {
    const rows = [{ "Ref. Lançamento": "" }, { "Ref. Lançamento": 5 }];
    expect(parseLancamentos(rows as any)).toHaveLength(1);
  });
});

describe("parseRateios", () => {
  it("mapeia colunas e ref_lancamento", () => {
    const rows = [
      {
        REF_LANCAMENTO: 1001,
        COD_NATUREZA: "2.01.010",
        DESC_NATUREZA_ORCAMENTARIA: "Materiais",
        STATUS_LANCAMENTO: "BAIXADO",
        VALOR_LIQUIDO: "1.000,00",
      },
    ];
    const r = parseRateios(rows);
    expect(r[0]).toMatchObject({
      ref_lancamento: 1001,
      cod_natureza: "2.01.010",
      valor_rateio: 1000,
    });
  });
});

describe("reconciliarRateios", () => {
  it("escala proporcionalmente quando Σ rateios ≠ valor_liquido", () => {
    const lancs = [{ ref_lancamento: 1, valor_liquido: 100 } as any];
    const rats = [
      {
        ref_lancamento: 1,
        cod_natureza: "a",
        desc_natureza: null,
        status_lancamento: null,
        valor_rateio: 60,
      },
      {
        ref_lancamento: 1,
        cod_natureza: "b",
        desc_natureza: null,
        status_lancamento: null,
        valor_rateio: 40,
      },
    ];
    // Σ = 100 já bate
    const r = reconciliarRateios(lancs, rats);
    const soma = r.reduce((a, x) => a + x.valor_rateio, 0);
    expect(soma).toBeCloseTo(100, 2);
  });

  it("preserva centavos no maior rateio (resíduo)", () => {
    const lancs = [{ ref_lancamento: 1, valor_liquido: 100 } as any];
    // Σ = 99 → fator ≈ 1.0101… → resíduo de centavos vai pro maior
    const rats = [
      {
        ref_lancamento: 1,
        cod_natureza: "a",
        desc_natureza: null,
        status_lancamento: null,
        valor_rateio: 33,
      },
      {
        ref_lancamento: 1,
        cod_natureza: "b",
        desc_natureza: null,
        status_lancamento: null,
        valor_rateio: 33,
      },
      {
        ref_lancamento: 1,
        cod_natureza: "c",
        desc_natureza: null,
        status_lancamento: null,
        valor_rateio: 33,
      },
    ];
    const r = reconciliarRateios(lancs, rats);
    const soma = r.reduce((a, x) => a + x.valor_rateio, 0);
    expect(Math.round(soma * 100) / 100).toBe(100);
  });

  it("mantém grupo intacto se diferença < 1 centavo", () => {
    const lancs = [{ ref_lancamento: 1, valor_liquido: 100.0 } as any];
    const rats = [
      {
        ref_lancamento: 1,
        cod_natureza: "a",
        desc_natureza: null,
        status_lancamento: null,
        valor_rateio: 100.0,
      },
    ];
    const r = reconciliarRateios(lancs, rats);
    expect(r[0].valor_rateio).toBe(100);
  });

  it("split igual entre múltiplas naturezas quando relatório repete VALOR_LIQUIDO do título", () => {
    // Cenário real do relatório TOTVS: 2 naturezas para o mesmo título,
    // ambas as linhas trazem o valor total do título (4291.20).
    const lancs = [{ ref_lancamento: 7388, valor_liquido: 4291.2 } as any];
    const rats = [
      {
        ref_lancamento: 7388,
        cod_natureza: "2.01.010",
        desc_natureza: "Materiais aplicados em Obras",
        status_lancamento: "BAIXADO",
        valor_rateio: 4291.2,
      },
      {
        ref_lancamento: 7388,
        cod_natureza: "2.01.012",
        desc_natureza: "Materiais para Solda",
        status_lancamento: "BAIXADO",
        valor_rateio: 4291.2,
      },
    ];
    const r = reconciliarRateios(lancs, rats);
    const soma = r.reduce((a, x) => a + x.valor_rateio, 0);
    expect(Math.round(soma * 100) / 100).toBe(4291.2);
    expect(r[0].valor_rateio).toBeCloseTo(2145.6, 2);
    expect(r[1].valor_rateio).toBeCloseTo(2145.6, 2);
  });

  it("não escala quando soma é zero ou alvo é zero", () => {
    const lancs = [{ ref_lancamento: 1, valor_liquido: 0 } as any];
    const rats = [
      {
        ref_lancamento: 1,
        cod_natureza: "a",
        desc_natureza: null,
        status_lancamento: null,
        valor_rateio: 10,
      },
    ];
    const r = reconciliarRateios(lancs, rats);
    expect(r[0].valor_rateio).toBe(10);
  });
});

describe("parseMatriz", () => {
  it("parseia duas fatias do mesmo título com CCustos diferentes", () => {
    const rows = [
      {
        IDLAN: 7388,
        DATA_EMISSAO: "15/03/2025",
        DATA_VENCIMENTO: "15/04/2025",
        VR_ORIGINAL: "4.291,20",
        COD_CCUSTO: "01.002.0202",
        DESC_CCUSTO: "Obra A",
        VR_RATEIO: "2.145,60",
        COD_NAT_ORC: "2.01.010",
        DESC_NAT_ORCAMENTARIA: "Materiais aplicados",
        SITUACAO: "BAIXADO",
        CODFILIAL: 1,
        TIPO_DOCUMENTO: "NF",
        DOCUMENTO: "123",
        CGCCFO: "12.345.678/0001-99",
        NOME: "Fornecedor A",
        NOMEFANTASIA: "Fantasia A",
        HISTORICO: "Compra de materiais",
        VALOR_LIQUIDO: "4.291,20",
        VALOR_BAIXADO: "4.291,20",
        DATA_BAIXA: "20/04/2025",
        STATUSLAN: 1,
      },
      {
        IDLAN: 7388,
        DATA_EMISSAO: "15/03/2025",
        DATA_VENCIMENTO: "15/04/2025",
        VR_ORIGINAL: "4.291,20",
        COD_CCUSTO: "01.003.0303",
        DESC_CCUSTO: "Obra B",
        VR_RATEIO: "2.145,60",
        COD_NAT_ORC: "2.01.012",
        DESC_NAT_ORCAMENTARIA: "Materiais para Solda",
        SITUACAO: "BAIXADO",
      },
    ];
    const r = parseMatriz(rows);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({
      ref_lancamento: 7388,
      cod_natureza: "2.01.010",
      desc_natureza: "Materiais aplicados",
      grupo: "2",
      subgrupo: "2.01",
      cod_ccusto: "01.002.0202",
      desc_ccusto: "Obra A",
      valor_rateio: 2145.6,
      valor_original: 4291.2,
      situacao_presumida: "BAIXADO",
      data_emissao: "2025-03-15",
      data_vencimento: "2025-04-15",
      filial: 1,
      tipo_documento: "NF",
      numero_documento: "123",
      cnpj_cpf: "12.345.678/0001-99",
      nome: "Fornecedor A",
      nome_fantasia: "Fantasia A",
      historico: "Compra de materiais",
      valor_liquido: 4291.2,
      valor_baixado: 4291.2,
      data_baixa: "2025-04-20",
      status_cod_matriz: 1,
    });
    expect(r[1].cod_ccusto).toBe("01.003.0303");
    expect(r[1].cod_natureza).toBe("2.01.012");
    expect(r[1].subgrupo).toBe("2.01");
  });

  it("descarta linhas sem IDLAN", () => {
    const rows = [
      { IDLAN: "", COD_NAT_ORC: "x" },
      { IDLAN: 1, COD_NAT_ORC: "1.02" },
    ];
    const r = parseMatriz(rows);
    expect(r).toHaveLength(1);
    expect(r[0].grupo).toBe("1");
    expect(r[0].subgrupo).toBe("1.02");
  });
});
