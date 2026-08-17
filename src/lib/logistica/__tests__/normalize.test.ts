import { describe, expect, it } from "vitest";
import {
  candidatosCidade,
  chaveMunicipio,
  isUF,
  normalizeUF,
  parseCidadeUF,
  slugCidade,
} from "@/lib/logistica/normalize";

describe("logistica · slugCidade", () => {
  it("remove acento, pontuação e caixa", () => {
    expect(slugCidade("Camaçari")).toBe("camacari");
    expect(slugCidade("CAMACARI ")).toBe("camacari");
    expect(slugCidade("São Paulo")).toBe("sao paulo");
    expect(slugCidade("Santa Bárbara d'Oeste")).toBe("santa barbara doeste");
    expect(slugCidade("Mogi-Mirim")).toBe("mogi mirim");
  });

  it("colapsa espaços e trata vazio", () => {
    expect(slugCidade("  Belo   Horizonte  ")).toBe("belo horizonte");
    expect(slugCidade("")).toBe("");
    expect(slugCidade(null)).toBe("");
    expect(slugCidade(undefined)).toBe("");
  });

  it("normaliza grafias diferentes da mesma cidade para a mesma chave", () => {
    expect(slugCidade("Camaçari")).toBe(slugCidade("camacari"));
    expect(slugCidade("São Gonçalo")).toBe(slugCidade("SAO GONCALO"));
  });
});

describe("logistica · normalizeUF", () => {
  it("aceita sigla em qualquer caixa", () => {
    expect(normalizeUF("ba")).toBe("BA");
    expect(normalizeUF("SP")).toBe("SP");
    expect(normalizeUF(" rj ")).toBe("RJ");
  });

  it("aceita nome por extenso, com ou sem acento", () => {
    expect(normalizeUF("Bahia")).toBe("BA");
    expect(normalizeUF("São Paulo")).toBe("SP");
    expect(normalizeUF("sao paulo")).toBe("SP");
    expect(normalizeUF("Minas Gerais")).toBe("MG");
    expect(normalizeUF("Espírito Santo")).toBe("ES");
  });

  it("devolve null para o que não é UF", () => {
    expect(normalizeUF("XX")).toBeNull();
    expect(normalizeUF("Camaçari")).toBeNull();
    expect(normalizeUF("")).toBeNull();
    expect(normalizeUF(null)).toBeNull();
  });

  it("isUF concorda com normalizeUF nas siglas", () => {
    expect(isUF("ba")).toBe(true);
    expect(isUF("XX")).toBe(false);
    expect(isUF(undefined)).toBe(false);
  });
});

describe("logistica · chaveMunicipio", () => {
  it("compõe slug + UF maiúscula", () => {
    expect(chaveMunicipio("Camaçari", "ba")).toBe("camacari|BA");
    expect(chaveMunicipio("CAMACARI", "BA")).toBe("camacari|BA");
  });
});

describe("logistica · parseCidadeUF", () => {
  it("reconhece os separadores usados na base", () => {
    expect(parseCidadeUF("Camaçari/BA")).toEqual({ cidade: "Camaçari", uf: "BA" });
    expect(parseCidadeUF("Camaçari - BA")).toEqual({ cidade: "Camaçari", uf: "BA" });
    expect(parseCidadeUF("Camaçari, BA")).toEqual({ cidade: "Camaçari", uf: "BA" });
    expect(parseCidadeUF("Camaçari – BA")).toEqual({ cidade: "Camaçari", uf: "BA" });
    expect(parseCidadeUF("Camaçari | BA")).toEqual({ cidade: "Camaçari", uf: "BA" });
  });

  it("aceita UF por extenso", () => {
    expect(parseCidadeUF("Camaçari/Bahia")).toEqual({ cidade: "Camaçari", uf: "BA" });
  });

  it("separa pelo último separador, preservando tudo que vem antes", () => {
    // A cidade sai com o prefixo descritivo junto de propósito: quem descasca
    // é o `geocodeCidade`, testando os candidatos contra a base real.
    expect(parseCidadeUF("Obra do Polo — Camaçari/BA")).toEqual({
      cidade: "Obra do Polo — Camaçari",
      uf: "BA",
    });
    expect(parseCidadeUF("Unidade 3 - Betim - MG")).toEqual({
      cidade: "Unidade 3 - Betim",
      uf: "MG",
    });
  });

  it("não trunca município cujo nome próprio tem hífen", () => {
    // São 27 na base do IBGE. Cortar no primeiro separador destruiria o nome.
    expect(parseCidadeUF("Xique-Xique/BA")).toEqual({ cidade: "Xique-Xique", uf: "BA" });
    expect(parseCidadeUF("Pindaré-Mirim/MA")).toEqual({ cidade: "Pindaré-Mirim", uf: "MA" });
    expect(parseCidadeUF("Mogi-Mirim")).toEqual({ cidade: "Mogi-Mirim", uf: null });
  });

  it("reconhece sigla colada no fim, sem separador", () => {
    expect(parseCidadeUF("Camaçari BA")).toEqual({ cidade: "Camaçari", uf: "BA" });
    expect(parseCidadeUF("Belo Horizonte MG")).toEqual({ cidade: "Belo Horizonte", uf: "MG" });
  });

  it("sem UF reconhecível, devolve o texto inteiro como cidade", () => {
    expect(parseCidadeUF("Camaçari")).toEqual({ cidade: "Camaçari", uf: null });
    // "SP" aqui é parte do nome, não sufixo de UF isolado
    expect(parseCidadeUF("Barracão")).toEqual({ cidade: "Barracão", uf: null });
  });

  it("trata entrada vazia", () => {
    expect(parseCidadeUF("")).toEqual({ cidade: null, uf: null });
    expect(parseCidadeUF("   ")).toEqual({ cidade: null, uf: null });
    expect(parseCidadeUF(null)).toEqual({ cidade: null, uf: null });
    expect(parseCidadeUF(undefined)).toEqual({ cidade: null, uf: null });
  });

  it("não inventa UF a partir de sufixo de duas letras desconhecido", () => {
    // "ZZ" não é UF: o texto sai inteiro e o geocoder tenta os candidatos.
    expect(parseCidadeUF("Camaçari/ZZ")).toEqual({ cidade: "Camaçari/ZZ", uf: null });
  });

  it("cobre os formatos reais do campo `colaboradores.cidade`", () => {
    // Valores observados no dump de produção. O campo guarda "Cidade/UF" numa
    // string só porque é assim que a busca por CEP gravava — foi o que fez a
    // primeira versão da tela posicionar 1 colaborador de 97.
    expect(parseCidadeUF("Rio Claro/SP")).toEqual({ cidade: "Rio Claro", uf: "SP" });
    expect(parseCidadeUF("Piracicaba/SP")).toEqual({ cidade: "Piracicaba", uf: "SP" });
    expect(parseCidadeUF("Santa Mariana/PR")).toEqual({ cidade: "Santa Mariana", uf: "PR" });
    expect(parseCidadeUF("PRADÓPOLIS/SP")).toEqual({ cidade: "PRADÓPOLIS", uf: "SP" });
    expect(parseCidadeUF("Chapadão do Céu/GO")).toEqual({ cidade: "Chapadão do Céu", uf: "GO" });
    expect(parseCidadeUF("Ipeúna/SP")).toEqual({ cidade: "Ipeúna", uf: "SP" });
    // Cidade cujo nome tem espaço e vem sem UF continua saindo inteira.
    expect(parseCidadeUF("Rio Claro")).toEqual({ cidade: "Rio Claro", uf: null });
    expect(parseCidadeUF("FLORESTOPOLIS")).toEqual({ cidade: "FLORESTOPOLIS", uf: null });
  });

  it("separa a UF colada por hífen sem perder o nome", () => {
    expect(parseCidadeUF("Santa Quitéria do Maranhão-MA")).toEqual({
      cidade: "Santa Quitéria do Maranhão",
      uf: "MA",
    });
  });
});

describe("logistica · candidatosCidade", () => {
  it("vai do texto fiel ao trecho descascado", () => {
    expect(candidatosCidade("Obra do Polo — Camaçari")).toEqual([
      "Obra do Polo — Camaçari",
      "Camaçari",
    ]);
  });

  it("devolve um só candidato quando não há o que descascar", () => {
    expect(candidatosCidade("Camaçari")).toEqual(["Camaçari"]);
    // Nome com hífen próprio: o texto fiel vem primeiro, e é ele que resolve.
    expect(candidatosCidade("Xique-Xique")[0]).toBe("Xique-Xique");
  });

  it("trata entrada vazia", () => {
    expect(candidatosCidade("")).toEqual([]);
    expect(candidatosCidade(null)).toEqual([]);
  });
});
