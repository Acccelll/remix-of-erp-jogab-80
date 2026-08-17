import { describe, it, expect } from "vitest";
import { parseHHMM, formatMinutes } from "../formatMinutes";
import { inferPeriodoDoNome, parseRelatorioCsv } from "../parseRelatorioCsv";
import { extrairCodigoNumerico, isCentroIndireto } from "@/lib/dp/codigos";

describe("formatMinutes/parseHHMM", () => {
  it("converte HH:MM para minutos", () => {
    expect(parseHHMM("01:30")).toBe(90);
    expect(parseHHMM("18:00")).toBe(1080);
    expect(parseHHMM("00:00")).toBe(0);
  });
  it("aceita decimais", () => {
    expect(parseHHMM("1,5")).toBe(90);
    expect(parseHHMM("2.25")).toBe(135);
  });
  it("formata minutos", () => {
    expect(formatMinutes(90)).toBe("01:30");
    expect(formatMinutes(0)).toBe("00:00");
    expect(formatMinutes(-30)).toBe("-00:30");
  });
});

describe("parseRelatorioCsv (formato CS Rodrigues agregado)", () => {
  const csv = [
    "\uFEFFNome da empresa;Nome do funcionário;PIS do funcionário;Nome do departamento;CPF do funcionário;Diurnas Normais;Noturnas Normais;Horas Previstas;Dia Falta;Falta e Atraso;Extra   0% ;Extra   60% ;Interjornada;DSR Cons.;DSR Deb.;Banco Total;Banco Saldo",
    "CS RODRIGUES;ADEMARIO CARNEIRO;12652752172;212 - POTIRENDABA;27182732831;;;18:00;2;18:00;;;;;;;",
    "CS RODRIGUES;ADRIANA MARIA;20985546217;101 - BARRACÃO;33633031812;09:00;;18:00;1;09:00;;00:26;;;;;",
    "CS RODRIGUES;ALEXANDRE;12435711451;209 - MARFRIG;86558005972;14:12;;18:00;;03:48;;03:39;;;;;",
  ].join("\n");

  it("identifica colunas e marca faltas", () => {
    const r = parseRelatorioCsv(csv);
    expect(r.rows.length).toBe(3);
    const adem = r.rows[0];
    expect(adem.horas_previstas_min).toBe(1080);
    expect(adem.dias_falta_qtd).toBe(2);
    expect(adem.horas_falta_min).toBe(1080);
    expect(adem.falta).toBe(true);
    expect(adem.horas_trabalhadas_min).toBe(0);
  });

  it("calcula trabalhadas como diurnas + noturnas e captura HE 60%", () => {
    const r = parseRelatorioCsv(csv);
    const alex = r.rows[2];
    expect(alex.horas_trabalhadas_min).toBe(parseHHMM("14:12"));
    expect(alex.horas_extra_60_min).toBe(parseHHMM("03:39"));
    expect(alex.falta).toBe(false);
  });

  it("captura empresa e departamento", () => {
    const r = parseRelatorioCsv(csv);
    expect(r.empresa).toBe("CS RODRIGUES");
    expect(r.rows[0].departamento).toBe("212 - POTIRENDABA");
    expect(r.rows[0].cpf).toBe("27182732831");
  });

  it("CSV agregado retorna periodoInicio/Fim nulos", () => {
    const r = parseRelatorioCsv(csv);
    expect(r.periodoInicio).toBeNull();
    expect(r.periodoFim).toBeNull();
  });
});

describe("inferPeriodoDoNome", () => {
  it("interpreta mês com 1 dígito em relatorio_YYYYMDD_HHMM", () => {
    expect(inferPeriodoDoNome("relatorio_2026616_1237.CSV")).toEqual({
      inicio: "2026-06-01",
      fim: "2026-06-16",
    });
  });

  it("ignora sequências com mês inválido", () => {
    expect(inferPeriodoDoNome("relatorio_202661_1237.CSV")).toBeNull();
  });
});

describe("Extra 0% (banco), Interjornada e Banco Saldo", () => {
  const csv = [
    "\uFEFFNome da empresa;Nome do funcionário;CPF do funcionário;Nome do departamento;Diurnas Normais;Horas Previstas;Dia Falta;Falta e Atraso;Extra   0% ;Extra   60% ;Interjornada;Banco Saldo",
    "CS RODRIGUES;ALEFI;11587389436;210 - COPI;11:35;18:00;;06:25;02:00;;;13:00",
    "CS RODRIGUES;ANDRESSA;39588567807;210 - COPI;09:00;18:00;1;09:00;;;02:19;-18:00",
  ].join("\n");

  it("Extra 0% vai para horas_compensadas_min (não HE 50%)", () => {
    const r = parseRelatorioCsv(csv);
    expect(r.rows[0].horas_compensadas_min).toBe(120);
    expect(r.rows[0].horas_extra_50_min).toBe(0);
  });
  it("Interjornada > 0 marca marcacao_invalida", () => {
    const r = parseRelatorioCsv(csv);
    expect(r.rows[1].interjornada_min).toBe(parseHHMM("02:19"));
    expect(r.rows[1].marcacao_invalida).toBe(true);
  });
  it("Banco Saldo aceita sinal negativo", () => {
    const r = parseRelatorioCsv(csv);
    expect(r.rows[0].banco_saldo_min).toBe(parseHHMM("13:00"));
    expect(r.rows[1].banco_saldo_min).toBe(-1080);
  });
});

describe("dpCodigos helpers", () => {
  it("extrai sufixo numérico de códigos de obra e depto", () => {
    expect(extrairCodigoNumerico("01.002.0210")).toBe("210");
    expect(extrairCodigoNumerico("210 - COPI")).toBe("210");
    expect(extrairCodigoNumerico("209.1")).toBe("209");
    expect(extrairCodigoNumerico(null)).toBeNull();
  });
  it("detecta centros indiretos", () => {
    expect(isCentroIndireto("ADM - Barracão")).toBe(true);
    expect(isCentroIndireto("101 - BARRACÃO")).toBe(true);
    expect(isCentroIndireto("102 - OBRAS")).toBe(true);
    expect(isCentroIndireto("210 - COPI")).toBe(false);
    expect(isCentroIndireto("212 - POTIRENDABA")).toBe(false);
  });
});
