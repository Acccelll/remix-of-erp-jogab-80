import { describe, it, expect } from "vitest";
import { diffOportunidade } from "@/lib/crm/historico";
import type { Oportunidade } from "@/types";

const base: Partial<Oportunidade> = {
  nome: "Obra A",
  clienteId: "1",
  status: "novo",
  estagio: "prospeccao",
  valorEstimado: 1000,
  observacao: "inicial",
  temperatura_temperatura: "morno",
  responsavelId: "10",
  email: "a@x.com",
  telefone: "119999",
  localObra: "SP",
};

describe("diffOportunidade", () => {
  it("retorna vazio quando 'antes' é nulo (criação)", () => {
    expect(diffOportunidade(null, base)).toEqual([]);
  });

  it("não acusa diferença quando nada muda", () => {
    expect(diffOportunidade(base, { ...base })).toEqual([]);
  });

  it("detecta mudança de título", () => {
    const d = diffOportunidade(base, { ...base, nome: "Obra B" });
    expect(d).toHaveLength(1);
    expect(d[0].label).toBe("Título");
  });

  it("detecta mudança de estágio (movimentação via formulário)", () => {
    const d = diffOportunidade(base, { ...base, estagio: "proposta" });
    expect(d.map((x) => x.label)).toContain("Estágio");
  });

  it("detecta observação com o nome de campo correto (observacao)", () => {
    const d = diffOportunidade(base, { ...base, observacao: "atualizada" });
    expect(d.map((x) => x.label)).toContain("Observação");
  });

  it("detecta temperatura com o nome de campo correto (temperatura_temperatura)", () => {
    const d = diffOportunidade(base, {
      ...base,
      temperatura_temperatura: "quente",
    });
    expect(d.map((x) => x.label)).toContain("Temperatura");
  });

  it("acumula múltiplas alterações", () => {
    const d = diffOportunidade(base, {
      ...base,
      nome: "Obra C",
      valorEstimado: 2000,
      estagio: "negociacao",
    });
    expect(d).toHaveLength(3);
    expect(d.map((x) => x.label).sort()).toEqual(
      ["Estágio", "Título", "Valor estimado"].sort(),
    );
  });
});
