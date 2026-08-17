import { describe, it, expect } from "vitest";
import { semanaDe, isoDate, proximasNSemanas, formatSemana, mesmaSemana } from "../semana";

describe("semana", () => {
  it("semanaDe retorna segunda da semana", () => {
    // 2024-06-26 = quarta
    expect(isoDate(semanaDe("2024-06-26"))).toBe("2024-06-24");
    // domingo cai na semana anterior (segunda 2024-06-17)
    expect(isoDate(semanaDe("2024-06-23"))).toBe("2024-06-17");
    // segunda fica na própria
    expect(isoDate(semanaDe("2024-06-24"))).toBe("2024-06-24");
  });

  it("proximasNSemanas gera segundas consecutivas", () => {
    const out = proximasNSemanas(6, "2024-06-26");
    expect(out).toHaveLength(6);
    expect(isoDate(out[0])).toBe("2024-06-24");
    expect(isoDate(out[5])).toBe("2024-07-29");
  });

  it("formatSemana retorna DD/MM–DD/MM", () => {
    expect(formatSemana("2024-06-26")).toBe("24/06–30/06");
  });

  it("mesmaSemana compara segundas", () => {
    expect(mesmaSemana("2024-06-24", "2024-06-30")).toBe(true);
    expect(mesmaSemana("2024-06-24", "2024-07-01")).toBe(false);
  });
});
