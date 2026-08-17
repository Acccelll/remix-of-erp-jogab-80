import { describe, it, expect } from "vitest";
import { calcularPPC, ppcPorSemana, paretoCausas } from "../ppc";

describe("ppc", () => {
  it("calcularPPC com vazio retorna 0", () => {
    expect(calcularPPC([])).toEqual({ comprometidos: 0, concluidos: 0, ppc: 0 });
  });

  it("calcularPPC = concluidos/comprometidos", () => {
    const r = calcularPPC([
      { semana_inicio: "2024-06-24", concluido: true },
      { semana_inicio: "2024-06-24", concluido: true },
      { semana_inicio: "2024-06-24", concluido: false },
      { semana_inicio: "2024-06-24", concluido: false },
    ]);
    expect(r.comprometidos).toBe(4);
    expect(r.concluidos).toBe(2);
    expect(r.ppc).toBe(0.5);
  });

  it("ppcPorSemana agrupa e ordena", () => {
    const r = ppcPorSemana([
      { semana_inicio: "2024-06-26", concluido: true },
      { semana_inicio: "2024-06-27", concluido: false },
      { semana_inicio: "2024-07-03", concluido: true },
    ]);
    expect(r).toHaveLength(2);
    expect(r[0].semana).toBe("2024-06-24");
    expect(r[0].ppc).toBe(0.5);
    expect(r[1].semana).toBe("2024-07-01");
    expect(r[1].ppc).toBe(1);
  });

  it("paretoCausas ordena descendente", () => {
    const r = paretoCausas([
      { semana_inicio: "2024-06-24", concluido: false, causa_chave: "material" },
      { semana_inicio: "2024-06-24", concluido: false, causa_chave: "material" },
      { semana_inicio: "2024-06-24", concluido: false, causa_chave: "clima" },
      { semana_inicio: "2024-06-24", concluido: true },
    ]);
    expect(r[0]).toEqual({ causa: "material", count: 2, pct: 2 / 3 });
    expect(r[1].causa).toBe("clima");
  });
});
