import { describe, expect, it } from "vitest";
import { resumoMensalToCsv, nomeArquivoResumo } from "../resumo-mensal-csv";
import type { ResumoMensalLinha } from "../resumo-mensal";

const linha = (over: Partial<ResumoMensalLinha> = {}): ResumoMensalLinha => ({
  chave: "2026-07|obra-a|Ana",
  mes: "2026-07",
  obra_id: "obra-a",
  assinado_por: "Ana",
  total: 3,
  primeiro_numero: "RDO-2026-0001",
  ultimo_numero: "RDO-2026-0003",
  ...over,
});

describe("resumoMensalToCsv", () => {
  it("gera header e escapa valores com separador", () => {
    const csv = resumoMensalToCsv(
      [linha({ assinado_por: 'Ana; "Silva"' })],
      { obraNome: () => "Obra; A" },
    );
    expect(csv.startsWith("\uFEFF")).toBe(true);
    const linhas = csv.replace("\uFEFF", "").split("\r\n");
    expect(linhas[0]).toBe("mes;obra;assinado_por;fechados;primeiro_numero;ultimo_numero");
    expect(linhas[1]).toContain('"Obra; A"');
    expect(linhas[1]).toContain('"Ana; ""Silva"""');
  });

  it("emite CSV vazio (apenas header) quando não há linhas", () => {
    const csv = resumoMensalToCsv([], { obraNome: (id) => id });
    expect(csv.replace("\uFEFF", "").split("\r\n")).toHaveLength(1);
  });

  it("nomeArquivoResumo usa período informado", () => {
    expect(nomeArquivoResumo("2026-07-01", "2026-07-31")).toBe(
      "rdo-resumo-mensal_2026-07-01_a_2026-07-31.csv",
    );
  });
});
