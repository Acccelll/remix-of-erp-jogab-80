import { describe, it, expect } from "vitest";
import { computePendingByDest } from "@/lib/quadros/pendingByDest";
import type { Colaborador, Obra } from "@/types";

const obra = (id: string, nome: string): Obra =>
  ({
    id,
    nome,
    cliente: "",
    ativa: true,
    requerIntegracao: false,
    integracaoInfo: "",
  }) as Obra;

const colab = (overrides: Partial<Colaborador>): Colaborador =>
  ({
    id: "c1",
    matricula: "0001",
    nome: "Fulano",
    funcao: "Pedreiro",
    ativo: true,
    obraAtualId: null,
    statusEspecial: null,
    mobilizacaoPendente: null,
    integracoes: [],
    historico: [],
    ...overrides,
  }) as unknown as Colaborador;

describe("computePendingByDest", () => {
  const obras = [obra("o1", "Obra Alpha"), obra("o2", "Obra Beta")];

  it("retorna mapa vazio quando ninguém tem pendência", () => {
    const m = computePendingByDest([colab({}), colab({ id: "c2" })], obras);
    expect(m.size).toBe(0);
  });

  it("agrupa por destino e resolve origem por obra", () => {
    const colaboradores = [
      colab({
        id: "c1",
        nome: "Ana",
        obraAtualId: "o1",
        mobilizacaoPendente: {
          obraDestinoId: "o2",
          obraDestinoNome: "Obra Beta",
          dataMobilizacao: "10/07/2026",
        },
      }),
      colab({
        id: "c2",
        nome: "Bruno",
        obraAtualId: "o1",
        mobilizacaoPendente: {
          obraDestinoId: "o2",
          obraDestinoNome: "Obra Beta",
          dataMobilizacao: "11/07/2026",
        },
      }),
    ];
    const m = computePendingByDest(colaboradores, obras);
    expect(m.get("o2")?.length).toBe(2);
    expect(m.get("o2")?.[0]).toMatchObject({
      nome: "Ana",
      origem: "Obra Alpha",
      data: "10/07/2026",
    });
  });

  it("usa __none__ quando destino vazio e Sem alocação quando origem nula", () => {
    const m = computePendingByDest(
      [
        colab({
          id: "c1",
          mobilizacaoPendente: {
            obraDestinoId: "",
            obraDestinoNome: "Sem alocação",
            dataMobilizacao: "01/01/2027",
          },
        }),
      ],
      obras,
    );
    expect(m.get("__none__")?.[0].origem).toBe("Sem alocação");
  });

  it("resolve nomes especiais (Folga/Férias/Afastamento) na origem", () => {
    const m = computePendingByDest(
      [
        colab({
          statusEspecial: "ferias",
          mobilizacaoPendente: {
            obraDestinoId: "o1",
            obraDestinoNome: "Obra Alpha",
            dataMobilizacao: "02/02/2027",
          },
        }),
      ],
      obras,
    );
    expect(m.get("o1")?.[0].origem).toBe("Férias");
  });

  it("ignora colaboradores inativos", () => {
    const m = computePendingByDest(
      [
        colab({
          ativo: false,
          mobilizacaoPendente: {
            obraDestinoId: "o1",
            obraDestinoNome: "Obra Alpha",
            dataMobilizacao: "03/03/2027",
          },
        }),
      ],
      obras,
    );
    expect(m.size).toBe(0);
  });
});
