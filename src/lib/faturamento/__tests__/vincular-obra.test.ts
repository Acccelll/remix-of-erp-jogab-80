import { describe, it, expect } from "vitest";
import { extrairObraDaDiscriminacao, extrairBmsEPedido } from "../vincular-obra";

describe("extrairObraDaDiscriminacao", () => {
  it("extrai código de obra entre pipes", () => {
    expect(extrairObraDaDiscriminacao("ref | OBRA 1234 | nota")).toBe("1234");
  });

  it("extrai código de obra em texto livre (3+ dígitos)", () => {
    expect(extrairObraDaDiscriminacao("Serviços executados na OBRA 567 conforme BMS")).toBe("567");
  });

  it("é case-insensitive", () => {
    expect(extrairObraDaDiscriminacao("obra 9999")).toBe("9999");
  });

  it("ignora 'OBRA' sem número", () => {
    expect(extrairObraDaDiscriminacao("serviços de obra civil")).toBeNull();
  });

  it("ignora números curtos no padrão livre", () => {
    expect(extrairObraDaDiscriminacao("OBRA 12")).toBeNull();
  });

  it("retorna null para texto vazio", () => {
    expect(extrairObraDaDiscriminacao("")).toBeNull();
  });

  it("prioriza o padrão entre pipes sobre o livre", () => {
    expect(extrairObraDaDiscriminacao("| OBRA 1111 | também OBRA 2222")).toBe("1111");
  });
});

describe("extrairBmsEPedido", () => {
  it("extrai número de BMS removendo zeros à esquerda", () => {
    expect(extrairBmsEPedido("BMS 007")).toEqual({ numero_bms: "7" });
  });

  it("extrai pedido com hífen/barra/ponto", () => {
    expect(extrairBmsEPedido("PEDIDO: PO-2025/01.A")).toEqual({ pedido: "PO-2025/01.A" });
  });

  it("extrai BMS e pedido simultaneamente", () => {
    expect(extrairBmsEPedido("BMS 12 PEDIDO: ABC123")).toEqual({
      numero_bms: "12",
      pedido: "ABC123",
    });
  });

  it("retorna vazio quando nada casa", () => {
    expect(extrairBmsEPedido("texto sem referências")).toEqual({});
  });
});
