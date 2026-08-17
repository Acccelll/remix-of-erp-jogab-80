import { describe, it, expect } from "vitest";
import {
  calcularStatusFinal,
  isRomaneioEditavel,
  podeRetentarMobilizacao,
  validarNovoRomaneio,
} from "../status";

describe("validarNovoRomaneio", () => {
  it("exige obra de destino", () => {
    const erros = validarNovoRomaneio({
      obraOrigemId: null,
      obraDestinoId: null,
      itensEstoqueCount: 1,
      itensPatrimonioCount: 0,
    });
    expect(erros).toContain("Obra de destino é obrigatória");
  });

  it("rejeita origem igual ao destino", () => {
    const erros = validarNovoRomaneio({
      obraOrigemId: "obra-1",
      obraDestinoId: "obra-1",
      itensEstoqueCount: 1,
      itensPatrimonioCount: 0,
    });
    expect(erros).toContain("Obra de origem e destino devem ser diferentes");
  });

  it("exige pelo menos um item", () => {
    const erros = validarNovoRomaneio({
      obraOrigemId: null,
      obraDestinoId: "obra-1",
      itensEstoqueCount: 0,
      itensPatrimonioCount: 0,
    });
    expect(erros).toContain("Adicione pelo menos um item de estoque ou patrimônio");
  });

  it("payload válido não gera erros", () => {
    const erros = validarNovoRomaneio({
      obraOrigemId: "obra-1",
      obraDestinoId: "obra-2",
      itensEstoqueCount: 1,
      itensPatrimonioCount: 0,
    });
    expect(erros).toEqual([]);
  });
});

describe("calcularStatusFinal", () => {
  it("sem falhas => confirmado", () => {
    expect(calcularStatusFinal(0)).toBe("confirmado");
  });

  it("com falhas => confirmado_parcial", () => {
    expect(calcularStatusFinal(2)).toBe("confirmado_parcial");
  });
});

describe("isRomaneioEditavel / podeRetentarMobilizacao", () => {
  it("apenas rascunho é editável", () => {
    expect(isRomaneioEditavel("rascunho")).toBe(true);
    expect(isRomaneioEditavel("confirmado")).toBe(false);
    expect(isRomaneioEditavel("confirmado_parcial")).toBe(false);
  });

  it("permite retry em confirmado_parcial e estoque_baixado", () => {
    expect(podeRetentarMobilizacao("confirmado_parcial")).toBe(true);
    expect(podeRetentarMobilizacao("estoque_baixado")).toBe(true);
    expect(podeRetentarMobilizacao("confirmado")).toBe(false);
    expect(podeRetentarMobilizacao("rascunho")).toBe(false);
  });
});
