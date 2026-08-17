import { describe, it, expect } from "vitest";
import {
  derivarOcorrencias,
  derivarOcorrenciasDoPeriodo,
  resumirPorStatus,
  type RegistroComId,
  type StatusOcorrencia,
} from "../ocorrencias";

function registro(over: Partial<RegistroComId> = {}): RegistroComId {
  return {
    id: "r1",
    colaborador_id: null,
    nome_csv: "FULANO",
    departamento_csv: "210 - COPI",
    obra_id: null,
    data: "2026-08-03",
    horas_previstas_min: 480,
    horas_trabalhadas_min: 480,
    horas_falta_min: 0,
    horas_extra_50_min: 0,
    horas_extra_60_min: 0,
    horas_extra_100_min: 0,
    interjornada_min: 0,
    banco_saldo_min: 0,
    marcacao_invalida: false,
    falta: false,
    atestado: false,
    ...over,
  };
}

const SEM_CADASTRO = new Map<string, string>();
const tipos = (r: RegistroComId) => derivarOcorrencias(r, SEM_CADASTRO).map((o) => o.tipo);

describe("derivarOcorrencias", () => {
  it("não gera nada para um dia normal", () => {
    expect(derivarOcorrencias(registro(), SEM_CADASTRO)).toEqual([]);
  });

  it("distingue falta sinalizada de dia sem marcação", () => {
    expect(
      tipos(registro({ falta: true, horas_trabalhadas_min: 0, horas_falta_min: 480 })),
    ).toEqual(["falta"]);
    expect(tipos(registro({ horas_trabalhadas_min: 0 }))).toEqual(["sem_marcacao"]);
  });

  it("não gera falta quando o dia tem atestado", () => {
    expect(tipos(registro({ falta: true, horas_trabalhadas_min: 0, atestado: true }))).toEqual([]);
  });

  it("gera ocorrência para marcação inválida e para interjornada violada", () => {
    expect(tipos(registro({ marcacao_invalida: true }))).toEqual(["marcacao_invalida"]);
    expect(tipos(registro({ interjornada_min: 45 }))).toEqual(["interjornada"]);
  });

  it("gera HE excedida só acima do teto diário de 2h", () => {
    expect(tipos(registro({ horas_extra_50_min: 120 }))).toEqual([]);
    expect(tipos(registro({ horas_extra_50_min: 121 }))).toEqual(["he_excedida"]);
  });

  it("soma as três faixas para comparar com o teto diário", () => {
    expect(tipos(registro({ horas_extra_50_min: 60, horas_extra_60_min: 70 }))).toEqual([
      "he_excedida",
    ]);
  });

  it("agrava a severidade da HE ao dobro do teto", () => {
    const [media] = derivarOcorrencias(registro({ horas_extra_50_min: 150 }), SEM_CADASTRO);
    const [alta] = derivarOcorrencias(registro({ horas_extra_50_min: 300 }), SEM_CADASTRO);
    expect(media.severidade).toBe("media");
    expect(alta.severidade).toBe("alta");
  });

  it("gera mais de uma ocorrência no mesmo dia quando os problemas são distintos", () => {
    expect(
      tipos(
        registro({
          falta: true,
          horas_trabalhadas_min: 0,
          horas_falta_min: 480,
          marcacao_invalida: true,
        }),
      ),
    ).toEqual(["falta", "marcacao_invalida"]);
  });

  it("carrega chave, nome do cadastro e magnitude para a fila", () => {
    const [o] = derivarOcorrencias(
      registro({ colaborador_id: "c1", obra_id: "o1", interjornada_min: 90 }),
      new Map([["c1", "ANA"]]),
    );
    expect(o).toMatchObject({
      chavePessoa: "c1",
      colaboradorId: "c1",
      obraId: "o1",
      nome: "ANA",
      registroId: "r1",
      data: "2026-08-03",
      minutos: 90,
    });
    expect(o.detalhe).toContain("01:30");
  });

  it("usa a jornada prevista como magnitude quando não há horas de falta lançadas", () => {
    const [o] = derivarOcorrencias(
      registro({ horas_trabalhadas_min: 0, horas_falta_min: 0 }),
      SEM_CADASTRO,
    );
    expect(o.minutos).toBe(480);
  });
});

describe("derivarOcorrenciasDoPeriodo", () => {
  it("concatena as ocorrências de todos os dias", () => {
    const ocorrencias = derivarOcorrenciasDoPeriodo(
      [
        registro({ id: "r1", data: "2026-08-01", falta: true, horas_trabalhadas_min: 0 }),
        registro({ id: "r2", data: "2026-08-02" }),
        registro({ id: "r3", data: "2026-08-03", interjornada_min: 30 }),
      ],
      SEM_CADASTRO,
    );
    expect(ocorrencias.map((o) => o.registroId)).toEqual(["r1", "r3"]);
  });
});

describe("resumirPorStatus", () => {
  it("conta por status e zera os ausentes", () => {
    const fila = [
      { status: "pendente" as StatusOcorrencia },
      { status: "pendente" as StatusOcorrencia },
      { status: "justificada" as StatusOcorrencia },
    ];
    expect(resumirPorStatus(fila)).toEqual({
      pendente: 2,
      em_tratativa: 0,
      justificada: 1,
      descartada: 0,
    });
  });
});
