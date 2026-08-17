import { describe, it, expect } from "vitest";
import {
  scoreRisco,
  classificarRisco,
  severidadeDe,
  contarRiscosNaMatriz,
  MATRIZ_5x5,
} from "../matriz";

describe("scoreRisco", () => {
  it("multiplica P × I", () => {
    expect(scoreRisco(3, 4)).toBe(12);
    expect(scoreRisco(5, 5)).toBe(25);
  });
  it("clampa fora do range 0..5", () => {
    expect(scoreRisco(0, 5)).toBe(0);
    expect(scoreRisco(7, 4)).toBe(20);
    expect(scoreRisco(-1, 3)).toBe(0);
  });
});

describe("classificarRisco", () => {
  it("respeita limites de classe", () => {
    expect(classificarRisco(1)).toBe("baixo");
    expect(classificarRisco(4)).toBe("baixo");
    expect(classificarRisco(5)).toBe("medio");
    expect(classificarRisco(9)).toBe("medio");
    expect(classificarRisco(10)).toBe("alto");
    expect(classificarRisco(15)).toBe("alto");
    expect(classificarRisco(16)).toBe("critico");
    expect(classificarRisco(25)).toBe("critico");
  });
});

describe("severidadeDe — simetria", () => {
  it("P×I = I×P para todas as combinações", () => {
    for (let p = 1; p <= 5; p++) {
      for (let i = 1; i <= 5; i++) {
        expect(severidadeDe(p, i)).toBe(severidadeDe(i, p));
      }
    }
  });
});

describe("MATRIZ_5x5", () => {
  it("tem 5 linhas × 5 colunas", () => {
    expect(MATRIZ_5x5).toHaveLength(5);
    for (const row of MATRIZ_5x5) expect(row).toHaveLength(5);
  });
  it("primeira linha é impacto=5 (catastrófico)", () => {
    for (const cel of MATRIZ_5x5[0]) expect(cel.i).toBe(5);
  });
});

describe("contarRiscosNaMatriz", () => {
  it("conta apenas abertos/em_andamento", () => {
    const m = contarRiscosNaMatriz([
      { probabilidade: 3, impacto: 4, status: "aberto" },
      { probabilidade: 3, impacto: 4, status: "em_andamento" },
      { probabilidade: 3, impacto: 4, status: "encerrado" },
      { probabilidade: 5, impacto: 5, status: "aberto" },
    ]);
    expect(m.get("3:4")).toBe(2);
    expect(m.get("5:5")).toBe(1);
  });
  it("ignora células fora do range", () => {
    const m = contarRiscosNaMatriz([
      { probabilidade: 0, impacto: 3, status: "aberto" },
      { probabilidade: 3, impacto: null, status: "aberto" },
    ]);
    expect(m.size).toBe(0);
  });
});
