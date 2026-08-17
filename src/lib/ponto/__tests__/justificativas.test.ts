import { describe, it, expect } from "vitest";
import {
  casarComOcorrencias,
  cobreDia,
  idadeEmDias,
  normalizaAprovacao,
  normalizaDataJust,
  normalizarJustificativas,
  normalizarTipos,
  usoVsLimite,
  type Justificativa,
  type OcorrenciaParaCasar,
} from "../justificativas";

function justificativa(over: Partial<Justificativa> = {}): Justificativa {
  return {
    id: "j1",
    idPerson: 10,
    nome: "ANA",
    cpf: "12345678901",
    dataInicio: "2026-08-03",
    dataFim: "2026-08-03",
    idTipo: "1",
    tipoNome: "Atestado médico",
    status: "aprovada",
    motivo: null,
    ...over,
  };
}

function ocorrencia(over: Partial<OcorrenciaParaCasar> = {}): OcorrenciaParaCasar {
  return {
    id: "o1",
    chave_pessoa: "c1",
    colaborador_id: "c1",
    nome: "ANA",
    data: "2026-08-03",
    tipo: "falta",
    status: "pendente",
    ...over,
  };
}

describe("normalizaDataJust", () => {
  it("aceita ISO com e sem hora, e formato brasileiro", () => {
    expect(normalizaDataJust("2026-08-03")).toBe("2026-08-03");
    expect(normalizaDataJust("2026-08-03T10:00:00")).toBe("2026-08-03");
    expect(normalizaDataJust("3/8/2026")).toBe("2026-08-03");
  });

  it("devolve null para o que não é data", () => {
    expect(normalizaDataJust("")).toBeNull();
    expect(normalizaDataJust(null)).toBeNull();
    expect(normalizaDataJust("ontem")).toBeNull();
  });
});

describe("normalizaAprovacao", () => {
  it("entende os códigos numéricos da API", () => {
    expect(normalizaAprovacao(0)).toBe("pendente");
    expect(normalizaAprovacao(1)).toBe("aprovada");
    expect(normalizaAprovacao(2)).toBe("reprovada");
    expect(normalizaAprovacao("1")).toBe("aprovada");
  });

  it("entende texto com e sem acento", () => {
    expect(normalizaAprovacao("Aprovada")).toBe("aprovada");
    expect(normalizaAprovacao("Em análise")).toBe("pendente");
    expect(normalizaAprovacao("Reprovado")).toBe("reprovada");
  });

  it("nunca chuta 'aprovada' para valor desconhecido", () => {
    // O fechamento automático da ocorrência depende disso.
    expect(normalizaAprovacao("xpto")).toBe("desconhecido");
    expect(normalizaAprovacao(null)).toBe("desconhecido");
    expect(normalizaAprovacao(99)).toBe("desconhecido");
    expect(normalizaAprovacao("não aprovada")).toBe("desconhecido");
  });
});

describe("normalizarJustificativas", () => {
  it("lê os campos por alias tolerante", () => {
    const [j] = normalizarJustificativas([
      {
        id: 7,
        idPerson: 42,
        name: "BRUNO",
        CPF: "123.456.789-01",
        ini: "2026-08-01",
        fim: "2026-08-05",
        idJustificationType: 3,
        justificationType: "Férias",
        approvalStatus: 1,
        reason: "programada",
      },
    ]);
    expect(j).toEqual({
      id: "7",
      idPerson: 42,
      nome: "BRUNO",
      cpf: "12345678901",
      dataInicio: "2026-08-01",
      dataFim: "2026-08-05",
      idTipo: "3",
      tipoNome: "Férias",
      status: "aprovada",
      motivo: "programada",
    });
  });

  it("descarta registro sem data — não teria como casar com um dia", () => {
    expect(normalizarJustificativas([{ id: 1, name: "SEM DATA" }])).toEqual([]);
  });

  it("usa a data inicial quando não há data final", () => {
    const [j] = normalizarJustificativas([{ ini: "2026-08-03", name: "ANA" }]);
    expect(j.dataFim).toBe("2026-08-03");
  });

  it("corrige intervalo invertido na origem", () => {
    const [j] = normalizarJustificativas([{ ini: "2026-08-10", fim: "2026-08-01", name: "ANA" }]);
    expect(j.dataInicio).toBe("2026-08-10");
    expect(j.dataFim).toBe("2026-08-10");
  });

  it("ignora CPF zerado, que a API usa como 'vazio'", () => {
    const [j] = normalizarJustificativas([{ ini: "2026-08-03", name: "ANA", cpf: 0 }]);
    expect(j.cpf).toBeNull();
  });
});

describe("normalizarTipos", () => {
  it("lê flags e limites", () => {
    const [t] = normalizarTipos([
      {
        id: 5,
        name: "Atestado",
        abonarDiaFalta: true,
        descontaDsr: false,
        informarCid: 1,
        qtdMensal: 2,
        qtdAnual: 12,
      },
    ]);
    expect(t).toMatchObject({
      id: "5",
      nome: "Atestado",
      abonarDiaFalta: true,
      descontaDsr: false,
      exigeCid: true,
      qtdMensal: 2,
      qtdAnual: 12,
      qtdTrimestral: null,
    });
  });

  it("descarta tipo sem id ou sem nome", () => {
    expect(normalizarTipos([{ name: "sem id" }, { id: 1 }])).toEqual([]);
  });
});

describe("cobreDia", () => {
  it("inclui as bordas do intervalo", () => {
    const j = justificativa({ dataInicio: "2026-08-01", dataFim: "2026-08-05" });
    expect(cobreDia(j, "2026-08-01")).toBe(true);
    expect(cobreDia(j, "2026-08-05")).toBe(true);
    expect(cobreDia(j, "2026-07-31")).toBe(false);
    expect(cobreDia(j, "2026-08-06")).toBe(false);
  });
});

describe("casarComOcorrencias", () => {
  const vinculo = { colaboradorPorIdPerson: new Map([[10, "c1"]]) };

  it("casa falta pendente com justificativa aprovada que cobre o dia", () => {
    const casadas = casarComOcorrencias([ocorrencia()], [justificativa()], vinculo);
    expect(casadas).toHaveLength(1);
    expect(casadas[0].ocorrencia.id).toBe("o1");
  });

  it("ignora justificativa não aprovada", () => {
    for (const status of ["pendente", "reprovada", "desconhecido"] as const) {
      expect(casarComOcorrencias([ocorrencia()], [justificativa({ status })], vinculo)).toEqual([]);
    }
  });

  it("não fecha marcação inválida nem HE excedida", () => {
    // Não são ausência: fechá-las esconderia falha de coleta e risco trabalhista.
    for (const tipo of ["marcacao_invalida", "interjornada", "he_excedida"]) {
      expect(casarComOcorrencias([ocorrencia({ tipo })], [justificativa()], vinculo)).toEqual([]);
    }
  });

  it("não mexe em ocorrência já resolvida", () => {
    for (const status of ["justificada", "descartada"]) {
      expect(casarComOcorrencias([ocorrencia({ status })], [justificativa()], vinculo)).toEqual([]);
    }
  });

  it("casa por CPF quando o idPerson não está vinculado", () => {
    const casadas = casarComOcorrencias([ocorrencia()], [justificativa({ idPerson: null })], {
      colaboradorPorCpf: new Map([["12345678901", "c1"]]),
    });
    expect(casadas).toHaveLength(1);
  });

  it("casa pelo nome quando a ocorrência não tem vínculo com o cadastro", () => {
    const semVinculo = ocorrencia({ colaborador_id: null, chave_pessoa: "ANA", nome: "ANA" });
    const casadas = casarComOcorrencias([semVinculo], [justificativa({ idPerson: null })], {});
    expect(casadas).toHaveLength(1);
  });

  it("não casa pessoa diferente no mesmo dia", () => {
    const outra = ocorrencia({ colaborador_id: "c2", chave_pessoa: "c2", nome: "BRUNO" });
    expect(casarComOcorrencias([outra], [justificativa()], vinculo)).toEqual([]);
  });

  it("não casa dia fora do intervalo", () => {
    const fora = ocorrencia({ data: "2026-08-20" });
    expect(casarComOcorrencias([fora], [justificativa()], vinculo)).toEqual([]);
  });
});

describe("usoVsLimite", () => {
  const tipos = normalizarTipos([
    { id: 1, name: "Atestado", qtdMensal: 2, qtdAnual: 12 },
    { id: 2, name: "Sem limite", name2: "x" },
  ]);

  it("compara contra o menor limite declarado e sinaliza estouro", () => {
    const js = [
      justificativa({ id: "a", idTipo: "1", dataInicio: "2026-08-01", dataFim: "2026-08-01" }),
      justificativa({ id: "b", idTipo: "1", dataInicio: "2026-08-02", dataFim: "2026-08-02" }),
      justificativa({ id: "c", idTipo: "1", dataInicio: "2026-08-03", dataFim: "2026-08-03" }),
    ];
    const [consumo] = usoVsLimite(js, tipos);
    expect(consumo).toMatchObject({
      tipoNome: "Atestado",
      usadas: 3,
      limite: 2,
      periodo: "mensal",
      excedido: true,
    });
  });

  it("não conta justificativa reprovada", () => {
    const js = [
      justificativa({ id: "a", idTipo: "1" }),
      justificativa({ id: "b", idTipo: "1", status: "reprovada" }),
    ];
    expect(usoVsLimite(js, tipos)[0].usadas).toBe(1);
  });

  it("ignora tipo sem nenhum limite declarado", () => {
    expect(usoVsLimite([justificativa({ idTipo: "2" })], tipos)).toEqual([]);
  });

  it("separa o consumo por pessoa", () => {
    const js = [
      justificativa({ id: "a", idPerson: 10, idTipo: "1" }),
      justificativa({ id: "b", idPerson: 11, nome: "BRUNO", idTipo: "1" }),
    ];
    expect(usoVsLimite(js, tipos)).toHaveLength(2);
  });
});

describe("idadeEmDias", () => {
  it("conta dias corridos e nunca devolve negativo", () => {
    expect(idadeEmDias("2026-08-01", "2026-08-04")).toBe(3);
    expect(idadeEmDias("2026-08-04", "2026-08-04")).toBe(0);
    expect(idadeEmDias("2026-08-10", "2026-08-04")).toBe(0);
  });
});
