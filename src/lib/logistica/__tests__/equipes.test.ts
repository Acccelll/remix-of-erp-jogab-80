import { describe, expect, it } from "vitest";
import {
  calcularDeficit,
  estaDisponivel,
  formatarDistancia,
  formatarDuracao,
  ranquearCandidatos,
  type ColaboradorLocalizado,
} from "@/lib/logistica/equipes";
import { celulaKey } from "@/lib/obras/histograma";
import type { Colaborador } from "@/types";

const colab = (p: Partial<Colaborador> & { id: string }): Colaborador =>
  ({
    nome: `Colab ${p.id}`,
    funcao: "Soldador",
    ativo: true,
    obraAtualId: null,
    statusEspecial: null,
    mobilizacaoPendente: null,
    documentos: [],
    historico: [],
    ferias: [],
    integracoes: [],
    ...p,
  }) as Colaborador;

const SALVADOR = { lat: -12.9718, lng: -38.5011 };
const CAMACARI = { lat: -12.6996, lng: -38.3263 }; // ~36 km de Salvador
const SAO_PAULO = { lat: -23.5329, lng: -46.6395 }; // ~1.450 km de Salvador

describe("logistica · estaDisponivel", () => {
  it("considera disponível quem está ativo e sem obra", () => {
    expect(estaDisponivel(colab({ id: "1" }))).toBe(true);
  });

  it("considera disponível quem está em status especial", () => {
    expect(estaDisponivel(colab({ id: "1", statusEspecial: "ferias" }))).toBe(true);
    expect(estaDisponivel(colab({ id: "2", statusEspecial: "__folga__" }))).toBe(true);
    // status especial vence a obra, igual à regra do Board
    expect(estaDisponivel(colab({ id: "3", obraAtualId: "10", statusEspecial: "folga" }))).toBe(
      true,
    );
  });

  it("não considera disponível quem está alocado, inativo ou já com mobilização pendente", () => {
    expect(estaDisponivel(colab({ id: "1", obraAtualId: "10" }))).toBe(false);
    expect(estaDisponivel(colab({ id: "2", ativo: false }))).toBe(false);
    expect(
      estaDisponivel(
        colab({
          id: "3",
          mobilizacaoPendente: {
            obraDestinoId: "10",
            obraDestinoNome: "Obra X",
            dataMobilizacao: "01/08/2026",
          },
        }),
      ),
    ).toBe(false);
  });
});

describe("logistica · calcularDeficit", () => {
  const funcoes = ["Soldador", "Pedreiro", "Eletricista"];

  it("subtrai efetivo atual do previsto no histograma", () => {
    const previsto = new Map([
      [celulaKey("10", "funcao", "Soldador"), 5],
      [celulaKey("10", "funcao", "Pedreiro"), 3],
    ]);
    const atual = new Map([
      [celulaKey("10", "funcao", "Soldador"), 2],
      [celulaKey("10", "funcao", "Pedreiro"), 3],
    ]);

    expect(calcularDeficit("10", funcoes, previsto, atual)).toEqual([
      { funcao: "Soldador", previsto: 5, atual: 2, deficit: 3 },
    ]);
  });

  it("ordena do maior déficit para o menor", () => {
    const previsto = new Map([
      [celulaKey("10", "funcao", "Soldador"), 4],
      [celulaKey("10", "funcao", "Pedreiro"), 10],
      [celulaKey("10", "funcao", "Eletricista"), 6],
    ]);
    const atual = new Map([[celulaKey("10", "funcao", "Eletricista"), 1]]);

    expect(calcularDeficit("10", funcoes, previsto, atual).map((d) => d.funcao)).toEqual([
      "Pedreiro", // 10
      "Eletricista", // 5
      "Soldador", // 4
    ]);
  });

  it("ignora função sem previsão lançada em vez de inventar déficit", () => {
    const atual = new Map([[celulaKey("10", "funcao", "Soldador"), 0]]);
    expect(calcularDeficit("10", funcoes, new Map(), atual)).toEqual([]);
  });

  it("ignora função com excedente ou em dia", () => {
    const previsto = new Map([
      [celulaKey("10", "funcao", "Soldador"), 2],
      [celulaKey("10", "funcao", "Pedreiro"), 2],
    ]);
    const atual = new Map([
      [celulaKey("10", "funcao", "Soldador"), 2], // em dia
      [celulaKey("10", "funcao", "Pedreiro"), 5], // excedente
    ]);
    expect(calcularDeficit("10", funcoes, previsto, atual)).toEqual([]);
  });

  it("não mistura obras diferentes", () => {
    const previsto = new Map([[celulaKey("99", "funcao", "Soldador"), 5]]);
    expect(calcularDeficit("10", funcoes, previsto, new Map())).toEqual([]);
  });
});

describe("logistica · ranquearCandidatos", () => {
  const candidatos: ColaboradorLocalizado[] = [
    { colaborador: colab({ id: "longe", funcao: "Soldador" }), coord: SAO_PAULO },
    { colaborador: colab({ id: "perto", funcao: "Soldador" }), coord: CAMACARI },
    { colaborador: colab({ id: "outra-funcao", funcao: "Pintor" }), coord: SALVADOR },
    { colaborador: colab({ id: "sem-coord", funcao: "Soldador" }), coord: null },
    {
      colaborador: colab({ id: "alocado", funcao: "Soldador", obraAtualId: "7" }),
      coord: SALVADOR,
    },
  ];
  const deficits = [{ funcao: "Soldador", previsto: 5, atual: 2, deficit: 3 }];

  it("exclui quem não está disponível", () => {
    const ranking = ranquearCandidatos({ destino: SALVADOR, candidatos, deficits });
    expect(ranking.map((c) => c.colaborador.id)).not.toContain("alocado");
  });

  it("põe função em déficit à frente, e entre elas a mais próxima", () => {
    const ranking = ranquearCandidatos({ destino: SALVADOR, candidatos, deficits });
    expect(ranking.map((c) => c.colaborador.id)).toEqual([
      "perto", // Soldador em déficit, ~36 km
      "longe", // Soldador em déficit, ~1.450 km
      "sem-coord", // Soldador em déficit, sem coordenada → depois de quem tem
      "outra-funcao", // sem déficit na função
    ]);
  });

  it("mantém quem não tem coordenada na lista, mas por último no grupo", () => {
    const ranking = ranquearCandidatos({ destino: SALVADOR, candidatos, deficits });
    const semCoord = ranking.find((c) => c.colaborador.id === "sem-coord");
    expect(semCoord).toBeDefined();
    expect(semCoord?.distanciaKm).toBeNull();
    expect(semCoord?.motivo).toContain("sem localização");
  });

  it("explica o motivo do ranking", () => {
    const ranking = ranquearCandidatos({ destino: SALVADOR, candidatos, deficits });
    expect(ranking[0].motivo).toContain("déficit");
    expect(ranking[0].motivo).toContain("km");
    expect(ranking.at(-1)?.motivo).toContain("Disponível");
  });

  it("ordena só por distância quando não há déficit", () => {
    const ranking = ranquearCandidatos({ destino: SALVADOR, candidatos, deficits: [] });
    expect(ranking.map((c) => c.colaborador.id)).toEqual([
      "outra-funcao", // 0 km
      "perto",
      "longe",
      "sem-coord",
    ]);
  });

  it("sem destino, não quebra e reporta ausência de distância", () => {
    const ranking = ranquearCandidatos({ destino: null, candidatos, deficits });
    expect(ranking).toHaveLength(4);
    expect(ranking.every((c) => c.distanciaKm === null)).toBe(true);
  });

  it("respeita o limite", () => {
    expect(ranquearCandidatos({ destino: SALVADOR, candidatos, deficits, limite: 2 })).toHaveLength(
      2,
    );
  });

  it("desempata por nome quando tudo mais é igual", () => {
    const empatados: ColaboradorLocalizado[] = [
      { colaborador: colab({ id: "b", nome: "Bruno" }), coord: SALVADOR },
      { colaborador: colab({ id: "a", nome: "Ana" }), coord: SALVADOR },
    ];
    const ranking = ranquearCandidatos({ destino: SALVADOR, candidatos: empatados, deficits: [] });
    expect(ranking.map((c) => c.colaborador.nome)).toEqual(["Ana", "Bruno"]);
  });
});

describe("logistica · formatação", () => {
  it("formata distância na escala certa", () => {
    expect(formatarDistancia(0.8)).toBe("800 m");
    expect(formatarDistancia(3.45)).toBe("3,5 km");
    expect(formatarDistancia(36)).toBe("36 km");
    expect(formatarDistancia(1240)).toBe("1.240 km");
    expect(formatarDistancia(NaN)).toBe("—");
  });

  it("formata duração na escala certa", () => {
    expect(formatarDuracao(45)).toBe("45 min");
    expect(formatarDuracao(60)).toBe("1 h");
    expect(formatarDuracao(200)).toBe("3 h 20 min");
    expect(formatarDuracao(-1)).toBe("—");
  });
});
