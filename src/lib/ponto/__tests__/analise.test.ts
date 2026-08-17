import { describe, it, expect } from "vitest";
import {
  atrasos,
  calcularKpis,
  compararPeriodos,
  distribuicaoAbsenteismo,
  ehFaltaCritica,
  faltasCriticas,
  heDiario,
  heEstouradas,
  nomeExibicao,
  ocorrenciasPorObra,
  periodoAnterior,
  variacaoPct,
  type RegistroPonto,
} from "../analise";

/** Dia neutro; cada teste sobrescreve só o que importa para a regra. */
function registro(over: Partial<RegistroPonto> = {}): RegistroPonto {
  return {
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

describe("ehFaltaCritica", () => {
  it("pega dia marcado como falta", () => {
    expect(ehFaltaCritica(registro({ falta: true, horas_trabalhadas_min: 0 }))).toBe(true);
  });

  it("pega jornada prevista sem nenhuma hora trabalhada", () => {
    expect(ehFaltaCritica(registro({ horas_trabalhadas_min: 0 }))).toBe(true);
  });

  it("ignora atestado — falta justificada não é falta crítica", () => {
    expect(
      ehFaltaCritica(registro({ falta: true, horas_trabalhadas_min: 0, atestado: true })),
    ).toBe(false);
  });

  it("ignora dia sem jornada prevista (folga)", () => {
    expect(ehFaltaCritica(registro({ horas_previstas_min: 0, horas_trabalhadas_min: 0 }))).toBe(
      false,
    );
  });
});

describe("calcularKpis", () => {
  it("exclui atestado do absenteísmo", () => {
    const kpis = calcularKpis(
      [
        registro({ horas_falta_min: 480, horas_trabalhadas_min: 0, falta: true }),
        registro({ horas_falta_min: 480, horas_trabalhadas_min: 0, atestado: true }),
      ],
      SEM_CADASTRO,
    );
    // 480 perdidos de 960 previstos — o atestado não entra no numerador.
    expect(kpis.absenteismoPct).toBe(50);
  });

  it("separa marcação inválida de interjornada violada", () => {
    const kpis = calcularKpis(
      [
        registro({ marcacao_invalida: true }),
        registro({ interjornada_min: 45 }),
        registro(),
        registro(),
      ],
      SEM_CADASTRO,
    );
    expect(kpis.marcacaoInvalidaPct).toBe(25);
    expect(kpis.interjornadaPct).toBe(25);
  });

  it("soma as três faixas de HE no top", () => {
    const kpis = calcularKpis(
      [
        registro({ nome_csv: "ANA", horas_extra_50_min: 60, horas_extra_100_min: 30 }),
        registro({ nome_csv: "BRUNO", horas_extra_60_min: 80 }),
      ],
      SEM_CADASTRO,
    );
    expect(kpis.heTotalMin).toBe(170);
    expect(kpis.topHe).toEqual({ chave: "ANA", nome: "ANA", min: 90 });
  });

  it("não elege top quando ninguém fez hora extra", () => {
    expect(calcularKpis([registro(), registro()], SEM_CADASTRO).topHe).toBeNull();
  });

  it("devolve zeros para período vazio", () => {
    const kpis = calcularKpis([], SEM_CADASTRO);
    expect(kpis).toMatchObject({
      absenteismoPct: 0,
      heTotalMin: 0,
      marcacaoInvalidaPct: 0,
      interjornadaPct: 0,
      topHe: null,
      diasApurados: 0,
    });
  });
});

describe("nomeExibicao", () => {
  const cadastro = new Map([["c1", "JOSÉ DA SILVA"]]);

  it("prefere o nome do cadastro quando há vínculo", () => {
    expect(nomeExibicao(registro({ colaborador_id: "c1", nome_csv: "JOSE SILVA" }), cadastro)).toBe(
      "JOSÉ DA SILVA",
    );
  });

  it("cai no nome da origem quando não há vínculo", () => {
    expect(nomeExibicao(registro({ nome_csv: "JOSE SILVA" }), cadastro)).toBe("JOSE SILVA");
  });

  it("cai no nome da origem quando o id não está no cadastro carregado", () => {
    expect(nomeExibicao(registro({ colaborador_id: "c9", nome_csv: "JOSE SILVA" }), cadastro)).toBe(
      "JOSE SILVA",
    );
  });
});

describe("faltasCriticas", () => {
  it("agrupa por colaborador e soma dias e horas", () => {
    const linhas = faltasCriticas(
      [
        registro({
          colaborador_id: "c1",
          falta: true,
          horas_trabalhadas_min: 0,
          horas_falta_min: 480,
        }),
        registro({
          colaborador_id: "c1",
          falta: true,
          horas_trabalhadas_min: 0,
          horas_falta_min: 480,
        }),
        registro({ colaborador_id: "c2", horas_trabalhadas_min: 0, horas_falta_min: 0 }),
      ],
      new Map([
        ["c1", "ANA"],
        ["c2", "BRUNO"],
      ]),
    );
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toMatchObject({ nome: "ANA", dias: 2, minutos: 960 });
    // Sem horas de falta registradas, a jornada prevista é a perda.
    expect(linhas[1]).toMatchObject({ nome: "BRUNO", dias: 1, minutos: 480 });
  });

  it("não lista quem só tem atestado", () => {
    const linhas = faltasCriticas(
      [registro({ falta: true, horas_trabalhadas_min: 0, atestado: true })],
      SEM_CADASTRO,
    );
    expect(linhas).toEqual([]);
  });
});

describe("heEstouradas", () => {
  it("filtra pelo percentual sobre o previsto e classifica o risco", () => {
    const linhas = heEstouradas(
      [
        // 240 min de HE60 sobre 960 previstos = 25% → acima do limite e acima de 210 min.
        registro({ nome_csv: "ANA", horas_previstas_min: 960, horas_extra_60_min: 240 }),
        // 60 de 960 = 6,25% → abaixo do limite.
        registro({ nome_csv: "BRUNO", horas_previstas_min: 960, horas_extra_60_min: 60 }),
      ],
      SEM_CADASTRO,
    );
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({ nome: "ANA", pct: 25, he60Min: 240, risco: "alto" });
  });

  it("classifica como médio quem estoura o percentual sem passar do teto de minutos", () => {
    const linhas = heEstouradas(
      [registro({ horas_previstas_min: 480, horas_extra_60_min: 120 })],
      SEM_CADASTRO,
    );
    expect(linhas[0]).toMatchObject({ pct: 25, risco: "medio" });
  });

  it("ignora colaborador sem jornada prevista (divisão por zero)", () => {
    expect(
      heEstouradas([registro({ horas_previstas_min: 0, horas_extra_60_min: 120 })], SEM_CADASTRO),
    ).toEqual([]);
  });
});

describe("atrasos", () => {
  it("pega jornada incompleta e ignora falta e atestado", () => {
    const linhas = atrasos(
      [
        registro({ nome_csv: "ANA", horas_falta_min: 30, horas_trabalhadas_min: 450 }),
        registro({ nome_csv: "BRUNO", horas_falta_min: 480, falta: true }),
        registro({ nome_csv: "CARLA", horas_falta_min: 480, atestado: true }),
      ],
      SEM_CADASTRO,
    );
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({ nome: "ANA", faltaMin: 30 });
  });
});

describe("séries dos gráficos", () => {
  it("conta ocorrências por obra, com rótulo para registro sem obra", () => {
    const series = ocorrenciasPorObra(
      [
        registro({ obra_id: "o1", falta: true, horas_trabalhadas_min: 0 }),
        registro({ obra_id: "o1", marcacao_invalida: true }),
        registro({ obra_id: null, marcacao_invalida: true }),
        registro({ obra_id: "o1" }),
      ],
      (id) => (id === "o1" ? "COPI" : id),
    );
    expect(series).toEqual([
      { obraId: "o1", obra: "COPI", ocorrencias: 2 },
      { obraId: null, obra: "Sem obra", ocorrencias: 1 },
    ]);
  });

  it("soma HE por dia em horas decimais, ordenado", () => {
    expect(
      heDiario([
        registro({ data: "2026-08-02", horas_extra_60_min: 90 }),
        registro({ data: "2026-08-01", horas_extra_50_min: 30 }),
        registro({ data: "2026-08-01", horas_extra_100_min: 30 }),
      ]),
    ).toEqual([
      { data: "2026-08-01", horas: 1 },
      { data: "2026-08-02", horas: 1.5 },
    ]);
  });

  it("classifica cada dia em uma fatia só do absenteísmo", () => {
    expect(
      distribuicaoAbsenteismo([
        registro({ horas_falta_min: 60, atestado: true }),
        registro({ horas_falta_min: 480, falta: true }),
        registro({ horas_falta_min: 15 }),
      ]),
    ).toEqual([
      { name: "Faltas", value: 480 },
      { name: "Atrasos", value: 15 },
      { name: "Atestados", value: 60 },
    ]);
  });
});

describe("tendência", () => {
  it("não inventa variação sem base de comparação", () => {
    expect(variacaoPct(10, 0)).toBeNull();
    const t = compararPeriodos(calcularKpis([registro()], SEM_CADASTRO), null);
    expect(t.absenteismoPp).toBeNull();
    expect(t.heTotalPct).toBeNull();
  });

  it("compara absenteísmo em pontos percentuais e HE em variação relativa", () => {
    const atual = calcularKpis(
      [registro({ horas_falta_min: 240, horas_extra_60_min: 120 })],
      SEM_CADASTRO,
    );
    const anterior = calcularKpis(
      [registro({ horas_falta_min: 120, horas_extra_60_min: 60 })],
      SEM_CADASTRO,
    );
    expect(compararPeriodos(atual, anterior).absenteismoPp).toBe(25);
    expect(compararPeriodos(atual, anterior).heTotalPct).toBe(100);
  });
});

describe("periodoAnterior", () => {
  it("devolve a janela imediatamente anterior de mesma duração", () => {
    // 31 dias em agosto → os 31 dias que terminam na véspera (julho inteiro).
    expect(periodoAnterior("2026-08-01", "2026-08-31")).toEqual({
      inicio: "2026-07-01",
      fim: "2026-07-31",
    });
  });

  it("conta a duração em dias corridos, não em meses", () => {
    // 01–15/03 são 15 dias → a janela anterior termina em 28/02 e começa em 14/02.
    expect(periodoAnterior("2026-03-01", "2026-03-15")).toEqual({
      inicio: "2026-02-14",
      fim: "2026-02-28",
    });
  });

  it("funciona para período de um único dia", () => {
    expect(periodoAnterior("2026-08-03", "2026-08-03")).toEqual({
      inicio: "2026-08-02",
      fim: "2026-08-02",
    });
  });

  it("rejeita período invertido ou inválido", () => {
    expect(periodoAnterior("2026-08-31", "2026-08-01")).toBeNull();
    expect(periodoAnterior("", "2026-08-01")).toBeNull();
  });
});
