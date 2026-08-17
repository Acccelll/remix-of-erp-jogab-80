import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseHoleriteXls } from "@/lib/dp/parser-holerite-xls";

function buildXlsx(rows: any[][]): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Holerites");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

const baseHeader = [
  "Código",
  "Nome",
  "CPF",
  "Admissão",
  "Cargo",
  "Centro de Custo",
  "Competência",
  "PROVENTOS",
  "DESCONTOS",
  "BASE INSS",
  "INSS",
  "BASE IRRF",
  "IRRF",
  "BASE FGTS",
  "FGTS",
  "LÍQUIDO",
  "PROVISÃO 13°",
  "INSS PROVISÃO 13°",
  "FGTS PROVISÃO 13°",
  "PROVISÃO FÉRIAS",
  "INSS PROVISÃO FÉRIAS",
  "FGTS PROVISÃO FÉRIAS",
  "INSS EMPRESA",
  "RAT",
  "INSS TERCEIROS",
  "8781 - DIAS NORMAIS P",
  "200 - HORAS EXTRAS 100% P",
  "980 - ADIANTAMENTO D",
];

function makeRow(over: Partial<Record<string, any>> = {}) {
  const r: any = {
    Código: "1",
    Nome: "Test",
    CPF: "11122233344",
    Admissão: "01/01/2020",
    Cargo: "Pedreiro",
    "Centro de Custo": "Obra X",
    Competência: "05/2026",
    PROVENTOS: 3000,
    DESCONTOS: 500,
    "BASE INSS": 3000,
    INSS: 300,
    "BASE IRRF": 0,
    IRRF: 0,
    "BASE FGTS": 3000,
    FGTS: 240,
    LÍQUIDO: 2200,
    "PROVISÃO 13°": 250,
    "INSS PROVISÃO 13°": 50,
    "FGTS PROVISÃO 13°": 20,
    "PROVISÃO FÉRIAS": 333,
    "INSS PROVISÃO FÉRIAS": 66,
    "FGTS PROVISÃO FÉRIAS": 27,
    "INSS EMPRESA": 600,
    RAT: 90,
    "INSS TERCEIROS": 168,
    "8781 - DIAS NORMAIS P": 3000,
    "200 - HORAS EXTRAS 100% P": 0,
    "980 - ADIANTAMENTO D": 0,
    ...over,
  };
  return baseHeader.map((h) => r[h]);
}

describe("parseHoleriteXls — regras de custo", () => {
  it("custoTotal inclui encargos sobre as provisões", () => {
    const buf = buildXlsx([baseHeader, makeRow()]);
    const { linhas, errors } = parseHoleriteXls(buf);
    expect(errors).toEqual([]);
    expect(linhas).toHaveLength(1);
    const l = linhas[0];
    // proventos 3000 + inss_emp 600 + rat 90 + terc 168 + fgts 240
    //   + prov13 250 + provFer 333 + inssProv13 50 + fgtsProv13 20
    //   + inssProvFer 66 + fgtsProvFer 27 = 4844
    expect(l.custoTotal).toBeCloseTo(4844, 2);
  });

  it("descontos do colaborador NÃO entram no custo da empresa", () => {
    // Aumenta o desconto e confirma que custoTotal não muda.
    const baseline = parseHoleriteXls(buildXlsx([baseHeader, makeRow()])).linhas[0].custoTotal;
    const semDesconto = parseHoleriteXls(buildXlsx([baseHeader, makeRow({ DESCONTOS: 0 })]))
      .linhas[0].custoTotal;
    expect(baseline).toBeCloseTo(semDesconto, 2);
  });

  it("identifica adiantamento pela presença da rubrica 980", () => {
    const adi = makeRow({ "980 - ADIANTAMENTO D": 1000, PROVENTOS: 1000, LÍQUIDO: 1000 });
    const { linhas } = parseHoleriteXls(buildXlsx([baseHeader, adi]));
    expect(linhas[0].tipo).toBe("adiantamento");
  });

  it("Fator K = custo_total / salario_base", () => {
    const { linhas } = parseHoleriteXls(buildXlsx([baseHeader, makeRow()]));
    const l = linhas[0];
    const fk = l.custoTotal / l.salarioBase;
    expect(fk).toBeCloseTo(4844 / 3000, 4);
  });
});
