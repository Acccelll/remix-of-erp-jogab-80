import { describe, it, expect } from "vitest";
import { aprovadorPara, aprovadoresPara, AlcadaError } from "../alcadas";

const ALCADAS = [
  { valor_min: 0, valor_max: 5000, papel_aprovador: "Compras", ordem: 1 },
  { valor_min: 5000.01, valor_max: 50000, papel_aprovador: "Gerencia", ordem: 1 },
  { valor_min: 50000.01, valor_max: null, papel_aprovador: "Diretoria", ordem: 1 },
  { valor_min: 50000.01, valor_max: null, papel_aprovador: "GM", ordem: 2 },
];

describe("alcadas", () => {
  it("faixa baixa → Compras", () => {
    expect(aprovadorPara(1000, ALCADAS).papel_aprovador).toBe("Compras");
  });
  it("faixa média → Gerencia", () => {
    expect(aprovadorPara(20000, ALCADAS).papel_aprovador).toBe("Gerencia");
  });
  it("sem teto → Diretoria + GM (multi-nível)", () => {
    const r = aprovadoresPara(200000, ALCADAS).map((a) => a.papel_aprovador);
    expect(r).toEqual(["Diretoria", "GM"]);
  });
  it("borda exata do max", () => {
    expect(aprovadorPara(5000, ALCADAS).papel_aprovador).toBe("Compras");
    expect(aprovadorPara(5000.01, ALCADAS).papel_aprovador).toBe("Gerencia");
  });
  it("sem cobertura → erro", () => {
    expect(() => aprovadorPara(10, [])).toThrowError(AlcadaError);
  });
  it("valor negativo → erro", () => {
    expect(() => aprovadorPara(-1, ALCADAS)).toThrowError(/inválido/i);
  });
});
