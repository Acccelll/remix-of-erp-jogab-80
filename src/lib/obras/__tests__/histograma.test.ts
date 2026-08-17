import { describe, expect, it } from "vitest";
import {
  OBRA_KEY_OCIOSO,
  celulaKey,
  montarGruposLinhas,
  montarPreview,
  segundaDaSemana,
} from "@/lib/obras/histograma";
import type { Colaborador, Contrato, Veiculo } from "@/types";

describe("histograma · segundaDaSemana", () => {
  it("acha a segunda-feira da semana e aplica offset", () => {
    // 2026-07-17 é sexta; segunda da semana = 13/07
    const sexta = new Date(2026, 6, 17);
    expect(segundaDaSemana(sexta)).toBe("2026-07-13");
    expect(segundaDaSemana(sexta, -1)).toBe("2026-07-06");
    expect(segundaDaSemana(sexta, 1)).toBe("2026-07-20");
    // domingo pertence à semana iniciada na segunda anterior
    expect(segundaDaSemana(new Date(2026, 6, 19))).toBe("2026-07-13");
    // segunda é ela mesma
    expect(segundaDaSemana(new Date(2026, 6, 13))).toBe("2026-07-13");
  });
});

describe("histograma · montarGruposLinhas", () => {
  it("agrupa funções por delegação e tipos por grupo", () => {
    const grupos = montarGruposLinhas(
      [
        { id: "1", nome: "Pedreiro", nrs: [], ativa: true, delegacaoId: "d1" },
        { id: "2", nome: "Soldador", nrs: [], ativa: true, delegacaoId: null },
        { id: "3", nome: "Inativa", nrs: [], ativa: false, delegacaoId: "d1" },
      ],
      [{ id: "d1", nome: "Civil", ordem: 0 }],
      [
        { id: "t1", nome: "Escavadeira", grupo: "Equipamentos", ativo: true },
        { id: "t2", nome: "Camionete", grupo: "Veículos", ativo: true },
        { id: "t3", nome: "Antigo", grupo: "Veículos", ativo: false },
      ],
    );
    expect(grupos.maoDeObra.map((g) => g.titulo)).toEqual(["Civil", "Sem delegação"]);
    expect(grupos.maoDeObra[0].linhas.map((l) => l.chave)).toEqual(["Pedreiro"]);
    expect(grupos.equipamentos.linhas.map((l) => l.chave)).toEqual(["Escavadeira"]);
    expect(grupos.veiculos.linhas.map((l) => l.chave)).toEqual(["Camionete"]);
  });
});

describe("histograma · montarPreview (fórmula da Gestão de Equipe)", () => {
  const colab = (p: Partial<Colaborador>): Colaborador =>
    ({ id: "c", nome: "n", funcao: "Pedreiro", ativo: true, obraAtualId: null, ...p }) as Colaborador;
  const veic = (p: Partial<Veiculo>): Veiculo =>
    ({ id: "v", nome: "v", tipo: "Camionete", ativo: true, obraAtualId: null, ...p }) as Veiculo;
  const contrato = (p: Partial<Contrato>): Contrato =>
    ({ id: "ct", ativo: true, tipo: "Máquina", obraAtualId: null, ...p }) as Contrato;

  it("aloca colaboradores por obra/função e ocioso para especiais/sem obra", () => {
    const preview = montarPreview({
      colaboradores: [
        colab({ id: "c1", obraAtualId: "10" }),
        colab({ id: "c2", obraAtualId: "10", funcao: "Soldador" }),
        colab({ id: "c3", obraAtualId: "10", statusEspecial: "ferias" }), // especial vence a obra
        colab({ id: "c4" }), // sem obra
        colab({ id: "c5", ativo: false, obraAtualId: "10" }), // inativo fora
      ],
      veiculos: [],
      contratos: [],
      obraIds: ["10"],
    });
    expect(preview.get(celulaKey("10", "funcao", "Pedreiro"))).toBe(1);
    expect(preview.get(celulaKey("10", "funcao", "Soldador"))).toBe(1);
    expect(preview.get(celulaKey(OBRA_KEY_OCIOSO, "funcao", "Pedreiro"))).toBe(2); // c3 + c4
  });

  it("conta veículos via motorista mobilizado e máquinas alugadas via contrato", () => {
    const preview = montarPreview({
      colaboradores: [colab({ id: "m1", obraAtualId: "10" })],
      veiculos: [
        veic({ id: "v1", motoristaId: "m1" }), // motorista na obra 10
        veic({ id: "v2", motoristaId: "outro" }), // motorista fora
        veic({ id: "v3", motoristaId: "m1", ativo: false }), // inativo
      ],
      contratos: [
        contrato({ id: "ct1", obraAtualId: "10", tipoMaquina: "Escavadeira" }),
        contrato({ id: "ct2", obraAtualId: "10", tipo: "Aluguel" as any }), // não é Máquina
      ],
      obraIds: ["10"],
    });
    expect(preview.get(celulaKey("10", "veiculo_tipo", "Camionete"))).toBe(1);
    expect(preview.get(celulaKey("10", "veiculo_tipo", "Escavadeira"))).toBe(1);
  });
});
