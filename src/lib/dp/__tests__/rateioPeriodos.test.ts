import { describe, expect, it } from "vitest";
import { proporcaoPorObra } from "@/lib/dp/rateioPeriodos";
import type { PeriodoAlocacao } from "@/types";

const periodo = (
  id: string,
  tipo: "obra" | "status",
  obraId: string | null,
  dias: number,
): PeriodoAlocacao => ({
  id,
  colaborador_id: "1",
  tipo,
  obra_id: obraId,
  obra_nome: obraId ? `Obra ${obraId}` : null,
  status: tipo === "status" ? "ferias" : null,
  data_inicio: "2026-01-01",
  data_fim: null,
  dias,
});

describe("proporcaoPorObra", () => {
  it("distribui integralmente entre as obras, ignorando férias e folga", () => {
    // 20 dias na obra A e 10 de férias: a obra recebe 100% do custo, não 2/3.
    // Contar as férias no denominador deixaria 1/3 do custo sem dono.
    const periodos = [periodo("p1", "obra", "A", 20), periodo("p2", "status", null, 10)];
    expect(proporcaoPorObra(periodos, "A")).toBe(1);
  });

  it("reparte proporcionalmente entre duas obras", () => {
    const periodos = [periodo("p1", "obra", "A", 30), periodo("p2", "obra", "B", 10)];
    expect(proporcaoPorObra(periodos, "A")).toBe(0.75);
    expect(proporcaoPorObra(periodos, "B")).toBe(0.25);
  });

  it("soma períodos repetidos da mesma obra", () => {
    const periodos = [
      periodo("p1", "obra", "A", 10),
      periodo("p2", "obra", "B", 10),
      periodo("p3", "obra", "A", 20),
    ];
    expect(proporcaoPorObra(periodos, "A")).toBe(0.75);
  });

  it("devolve 0 quando não há período em obra", () => {
    expect(proporcaoPorObra([periodo("p1", "status", null, 30)], "A")).toBe(0);
    expect(proporcaoPorObra([], "A")).toBe(0);
  });

  it("desconsidera período de obra sem id de obra", () => {
    // Defensivo: uma linha de obra sem `obra_id` não é atribuível e não pode
    // inflar o denominador.
    const periodos = [periodo("p1", "obra", null, 50), periodo("p2", "obra", "A", 10)];
    expect(proporcaoPorObra(periodos, "A")).toBe(1);
  });
});
