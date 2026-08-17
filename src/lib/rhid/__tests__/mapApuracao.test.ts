import { describe, it, expect } from "vitest";
import {
  camposNaoMapeados,
  duracaoParaMinutos,
  explicarMapeamento,
  mapApuracaoToRows,
  normalizaData,
  type RhidPessoa,
} from "../mapApuracao";

const PESSOA: RhidPessoa = {
  idPerson: 42,
  name: "João da Silva",
  cpf: "12345678901",
  pis: "12345678901",
  registration: "0001",
  departamento: "210 - COPI",
};

const pessoas = new Map<number, RhidPessoa>([[PESSOA.idPerson, PESSOA]]);

describe("duracaoParaMinutos", () => {
  it("interpreta HH:MM como horas e minutos", () => {
    expect(duracaoParaMinutos("08:30")).toBe(510);
    expect(duracaoParaMinutos("-01:15")).toBe(-75);
  });

  it("interpreta inteiro como minutos", () => {
    expect(duracaoParaMinutos(480)).toBe(480);
    expect(duracaoParaMinutos("480")).toBe(480);
  });

  it("interpreta fracionário como horas decimais", () => {
    expect(duracaoParaMinutos(7.5)).toBe(450);
    expect(duracaoParaMinutos("1,5")).toBe(90);
  });

  it("devolve 0 para ausente ou inválido", () => {
    expect(duracaoParaMinutos(null)).toBe(0);
    expect(duracaoParaMinutos(undefined)).toBe(0);
    expect(duracaoParaMinutos("")).toBe(0);
    expect(duracaoParaMinutos("abc")).toBe(0);
    expect(duracaoParaMinutos(NaN)).toBe(0);
  });
});

describe("normalizaData", () => {
  it("aceita ISO, ISO com hora e DD/MM/AAAA", () => {
    expect(normalizaData("2026-06-15")).toBe("2026-06-15");
    expect(normalizaData("2026-06-15T00:00:00")).toBe("2026-06-15");
    expect(normalizaData("15/06/2026")).toBe("2026-06-15");
  });

  it("rejeita data inexistente ou formato desconhecido", () => {
    expect(normalizaData("2026-02-30")).toBeNull();
    expect(normalizaData("junho")).toBeNull();
    expect(normalizaData(null)).toBeNull();
  });
});

describe("mapApuracaoToRows", () => {
  it("mapeia os campos documentados da apuração", () => {
    const rows = mapApuracaoToRows(
      [
        {
          idPerson: 42,
          name: "João da Silva",
          date: "2026-06-15",
          totalHorasTrabalhadas: "08:00",
          totalHorasPrevistas: "08:00",
          saldoBancoFinalDia: "-00:30",
          horaExtra60: "01:00",
        },
      ],
      pessoas,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      nome: "João da Silva",
      data: "2026-06-15",
      horas_trabalhadas_min: 480,
      horas_previstas_min: 480,
      horas_extra_60_min: 60,
      banco_saldo_min: -30,
      falta: false,
      atestado: false,
    });
  });

  it("completa CPF, matrícula e departamento a partir do cadastro", () => {
    const rows = mapApuracaoToRows([{ idPerson: 42, date: "2026-06-15" }], pessoas);
    expect(rows[0]).toMatchObject({
      cpf: "12345678901",
      matricula: "0001",
      departamento: "210 - COPI",
    });
  });

  it("casa aliases independente de caixa, acento e separador", () => {
    const rows = mapApuracaoToRows(
      [
        {
          idPerson: 42,
          date: "2026-06-15",
          Total_Horas_Trabalhadas: "07:00",
          "Hora Extra 50": "00:30",
        },
      ],
      pessoas,
    );
    expect(rows[0].horas_trabalhadas_min).toBe(420);
    expect(rows[0].horas_extra_50_min).toBe(30);
  });

  it("marca falta quando há dia de falta e nenhuma hora trabalhada", () => {
    const [row] = mapApuracaoToRows(
      [{ idPerson: 42, date: "2026-06-16", diasFalta: 1, totalHorasTrabalhadas: "00:00" }],
      pessoas,
    );
    expect(row.falta).toBe(true);
    expect(row.dias_falta_qtd).toBe(1);
  });

  it("não marca falta se houve trabalho no dia", () => {
    const [row] = mapApuracaoToRows(
      [{ idPerson: 42, date: "2026-06-16", diasFalta: 1, totalHorasTrabalhadas: "04:00" }],
      pessoas,
    );
    expect(row.falta).toBe(false);
  });

  it("detecta atestado pelo campo e pela observação", () => {
    const [porCampo] = mapApuracaoToRows(
      [{ idPerson: 42, date: "2026-06-17", horasAbonadas: "08:00" }],
      pessoas,
    );
    const [porObs] = mapApuracaoToRows(
      [{ idPerson: 42, date: "2026-06-17", observacao: "Atestado médico" }],
      pessoas,
    );
    expect(porCampo.atestado).toBe(true);
    expect(porObs.atestado).toBe(true);
  });

  it("marca marcação inválida quando há interjornada", () => {
    const [row] = mapApuracaoToRows(
      [{ idPerson: 42, date: "2026-06-18", interjornada: "00:45" }],
      pessoas,
    );
    expect(row.marcacao_invalida).toBe(true);
    expect(row.interjornada_min).toBe(45);
  });

  it("zera campos ausentes em vez de quebrar", () => {
    const [row] = mapApuracaoToRows([{ idPerson: 42, date: "2026-06-19" }], pessoas);
    expect(row.horas_trabalhadas_min).toBe(0);
    expect(row.horas_extra_100_min).toBe(0);
    expect(row.horas_compensadas_min).toBe(0);
    expect(row.dias_falta_qtd).toBe(0);
  });

  it("usa o nome da própria apuração quando a pessoa não está no cadastro", () => {
    const [row] = mapApuracaoToRows(
      [{ idPerson: 999, name: "Maria Santos", date: "2026-06-15" }],
      pessoas,
    );
    expect(row.nome).toBe("Maria Santos");
    expect(row.cpf).toBeUndefined();
  });

  it("descarta registros sem nome identificável", () => {
    expect(mapApuracaoToRows([{ idPerson: 999, date: "2026-06-15" }], pessoas)).toHaveLength(0);
  });

  it("gera uma linha por dia apurado", () => {
    const dias = ["2026-06-15", "2026-06-16", "2026-06-17"].map((date) => ({
      idPerson: 42,
      date,
      totalHorasTrabalhadas: "08:00",
    }));
    expect(mapApuracaoToRows(dias, pessoas)).toHaveLength(3);
  });
});

describe("diagnóstico", () => {
  it("lista apenas os campos que nenhum alias reconheceu", () => {
    const naoMapeados = camposNaoMapeados({
      idPerson: 42,
      date: "2026-06-15",
      totalHorasTrabalhadas: "08:00",
      campoDesconhecidoAcjef: 1,
      outroCampoNovo: "x",
    });
    expect(naoMapeados).toEqual(["campoDesconhecidoAcjef", "outroCampoNovo"]);
  });

  it("explica a unidade interpretada de cada duração", () => {
    const linhas = explicarMapeamento({ totalHorasTrabalhadas: "08:00" });
    const trabalhadas = linhas.find((l) => l.campo === "horas_trabalhadas_min");
    expect(trabalhadas).toMatchObject({
      origem: "totalHorasTrabalhadas",
      bruto: '"08:00"',
      minutos: 480,
    });
    // Campo ausente aparece como não encontrado, não como erro.
    expect(linhas.find((l) => l.campo === "horas_extra_100_min")).toMatchObject({
      origem: "—",
      minutos: 0,
    });
  });

  it("não quebra sem amostra", () => {
    expect(camposNaoMapeados(null)).toEqual([]);
    expect(explicarMapeamento(null)).toEqual([]);
  });
});
