import { describe, expect, it } from "vitest";
import { ufPorCep } from "@/lib/logistica/cep-uf";

describe("logistica · ufPorCep", () => {
  it("aceita o CEP em qualquer formatação", () => {
    // A base tem os três formatos convivendo no mesmo campo.
    expect(ufPorCep("13503-661")).toBe("SP");
    expect(ufPorCep("13.503-661")).toBe("SP");
    expect(ufPorCep("13503661")).toBe("SP");
  });

  it("resolve capitais de cada região", () => {
    expect(ufPorCep("01310-100")).toBe("SP"); // Av. Paulista
    expect(ufPorCep("20040-020")).toBe("RJ"); // Centro, Rio
    expect(ufPorCep("30130-000")).toBe("MG"); // Belo Horizonte
    expect(ufPorCep("40020-000")).toBe("BA"); // Salvador
    expect(ufPorCep("80010-000")).toBe("PR"); // Curitiba
    expect(ufPorCep("90010-000")).toBe("RS"); // Porto Alegre
    expect(ufPorCep("70040-010")).toBe("DF"); // Brasília
  });

  it("acerta os limites exatos das faixas", () => {
    expect(ufPorCep("01000000")).toBe("SP");
    expect(ufPorCep("19999999")).toBe("SP");
    expect(ufPorCep("20000000")).toBe("RJ");
    expect(ufPorCep("28999999")).toBe("RJ");
    expect(ufPorCep("29000000")).toBe("ES");
    expect(ufPorCep("99999999")).toBe("RS");
  });

  it("respeita as faixas descontínuas", () => {
    // AM é partido pelo enclave de RR em 693xx
    expect(ufPorCep("69050000")).toBe("AM");
    expect(ufPorCep("69301000")).toBe("RR");
    expect(ufPorCep("69500000")).toBe("AM");
    expect(ufPorCep("69900000")).toBe("AC");
    // DF e GO se alternam em 72–73
    expect(ufPorCep("72000000")).toBe("DF");
    expect(ufPorCep("72800000")).toBe("GO");
    expect(ufPorCep("73000000")).toBe("DF");
    expect(ufPorCep("73700000")).toBe("GO");
    // RO aparece dos dois lados de MT
    expect(ufPorCep("76800000")).toBe("RO");
    expect(ufPorCep("78000000")).toBe("MT");
    expect(ufPorCep("78900000")).toBe("RO");
    // PA e o enclave do AP
    expect(ufPorCep("66000000")).toBe("PA");
    expect(ufPorCep("68900000")).toBe("AP");
  });

  it("devolve null para entrada inválida em vez de chutar", () => {
    expect(ufPorCep("")).toBeNull();
    expect(ufPorCep(null)).toBeNull();
    expect(ufPorCep(undefined)).toBeNull();
    expect(ufPorCep("1350")).toBeNull(); // curto demais
    expect(ufPorCep("135036611")).toBeNull(); // longo demais
    expect(ufPorCep("abcdefgh")).toBeNull();
    expect(ufPorCep("00999999")).toBeNull(); // abaixo da primeira faixa
  });

  it("cobre todo o espaço de CEPs válidos sem buraco", () => {
    // Varre o início de cada centena de milhar: nenhum CEP acima de 01000-000
    // pode ficar órfão, senão haveria colaborador sem UF dedutível.
    const orfaos: string[] = [];
    for (let prefixo = 10; prefixo <= 999; prefixo++) {
      const cep = String(prefixo).padStart(3, "0") + "00000";
      if (!ufPorCep(cep)) orfaos.push(cep);
    }
    expect(orfaos).toEqual([]);
  });
});
