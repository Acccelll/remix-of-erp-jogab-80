import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetMunicipiosCache,
  carregarMunicipios,
  geocodeCidade,
  municipiosHomonimos,
  MUNICIPIOS_URL,
} from "@/lib/logistica/municipios";

/** O arquivo real de `public/geo` — o teste valida o dado, não um dublê. */
const arquivoReal = JSON.parse(
  readFileSync(resolve(process.cwd(), "public/geo/municipios-br.json"), "utf-8"),
);

function mockFetch(resposta: unknown, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: async () => resposta,
  });
}

describe("logistica · integridade do arquivo public/geo/municipios-br.json", () => {
  it("tem os 5.571 municípios das 27 UFs", () => {
    expect(arquivoReal.total).toBe(5571);
    expect(arquivoReal.municipios).toHaveLength(5571);
    expect(new Set(arquivoReal.municipios.map((m: unknown[]) => m[1])).size).toBe(27);
  });

  it("tem coordenadas plausíveis para o território brasileiro", () => {
    for (const [nome, uf, lat, lng] of arquivoReal.municipios as [
      string,
      string,
      number,
      number,
    ][]) {
      expect(typeof nome, `nome de ${nome}`).toBe("string");
      expect(uf, `UF de ${nome}`).toMatch(/^[A-Z]{2}$/);
      // Brasil vai de ~5.3°N (Roraima) a ~-33.8°S, e de ~-74°W a ~-32.4°W.
      expect(lat, `latitude de ${nome}/${uf}`).toBeGreaterThan(-34);
      expect(lat, `latitude de ${nome}/${uf}`).toBeLessThan(6);
      expect(lng, `longitude de ${nome}/${uf}`).toBeGreaterThan(-75);
      expect(lng, `longitude de ${nome}/${uf}`).toBeLessThan(-32);
    }
  });
});

describe("logistica · carregarMunicipios", () => {
  beforeEach(() => {
    __resetMunicipiosCache();
  });

  afterEach(() => {
    __resetMunicipiosCache();
    vi.unstubAllGlobals();
  });

  it("busca o arquivo e monta os índices", async () => {
    const fetchMock = mockFetch(arquivoReal);
    vi.stubGlobal("fetch", fetchMock);

    const indice = await carregarMunicipios();

    expect(fetchMock).toHaveBeenCalledWith(MUNICIPIOS_URL);
    expect(indice.todos).toHaveLength(5571);
    expect(indice.porChave.get("camacari|BA")).toMatchObject({ nome: "Camaçari", uf: "BA" });
  });

  it("memoiza: uma única requisição para várias chamadas", async () => {
    const fetchMock = mockFetch(arquivoReal);
    vi.stubGlobal("fetch", fetchMock);

    await Promise.all([carregarMunicipios(), carregarMunicipios()]);
    await carregarMunicipios();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("devolve índice vazio quando a rede falha, sem lançar", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const indice = await carregarMunicipios();

    expect(indice.todos).toHaveLength(0);
    expect(geocodeCidade(indice, "Camaçari", "BA")).toBeNull();
  });

  it("devolve índice vazio quando o arquivo tem formato inesperado", async () => {
    vi.stubGlobal("fetch", mockFetch({ municipios: "não é array" }));

    const indice = await carregarMunicipios();

    expect(indice.todos).toHaveLength(0);
  });

  it("permite nova tentativa depois de uma falha", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect((await carregarMunicipios()).todos).toHaveLength(0);

    vi.stubGlobal("fetch", mockFetch(arquivoReal));
    expect((await carregarMunicipios()).todos).toHaveLength(5571);
  });
});

describe("logistica · geocodeCidade", () => {
  let indice: Awaited<ReturnType<typeof carregarMunicipios>>;

  beforeEach(async () => {
    __resetMunicipiosCache();
    vi.stubGlobal("fetch", mockFetch(arquivoReal));
    indice = await carregarMunicipios();
  });

  afterEach(() => {
    __resetMunicipiosCache();
    vi.unstubAllGlobals();
  });

  it("resolve com cidade + UF, ignorando acento e caixa", () => {
    const esperado = { nome: "Camaçari", uf: "BA" };
    expect(geocodeCidade(indice, "Camaçari", "BA")).toMatchObject(esperado);
    expect(geocodeCidade(indice, "camacari", "ba")).toMatchObject(esperado);
    expect(geocodeCidade(indice, "CAMACARI", "Bahia")).toMatchObject(esperado);
  });

  it("resolve sem UF quando o nome é único no país", () => {
    const camacari = geocodeCidade(indice, "Camaçari");
    expect(camacari).toMatchObject({ nome: "Camaçari", uf: "BA" });
  });

  it("recusa resolver homônimo sem UF em vez de chutar", () => {
    // "Bom Jesus" existe em várias UFs; escolher uma colocaria a pessoa a
    // milhares de km do lugar certo.
    const homonimos = municipiosHomonimos(indice, "Bom Jesus");
    expect(homonimos.length).toBeGreaterThan(1);
    expect(geocodeCidade(indice, "Bom Jesus")).toBeNull();
    // Com a UF, resolve normalmente.
    expect(geocodeCidade(indice, "Bom Jesus", "PI")).toMatchObject({ uf: "PI" });
    expect(geocodeCidade(indice, "Bom Jesus", "RS")).toMatchObject({ uf: "RS" });
  });

  it("tolera cidade e UF vindas juntas numa string só", () => {
    // Formato que a base guarda de fato — ver geocoding-base-real.test.ts.
    const esperado = { nome: "Camaçari", uf: "BA" };
    expect(geocodeCidade(indice, "Camaçari/BA")).toMatchObject(esperado);
    expect(geocodeCidade(indice, "Camaçari - BA")).toMatchObject(esperado);
    expect(geocodeCidade(indice, "camacari/ba")).toMatchObject(esperado);
    // Desambigua homônimo pela UF embutida no texto.
    expect(geocodeCidade(indice, "Bom Jesus/RS")).toMatchObject({ uf: "RS" });
  });

  it("o argumento `uf` tem precedência sobre a UF embutida no texto", () => {
    expect(geocodeCidade(indice, "Bom Jesus/RS", "PI")).toMatchObject({ uf: "PI" });
  });

  it("devolve null para cidade inexistente ou entrada vazia", () => {
    expect(geocodeCidade(indice, "Cidade Que Não Existe", "SP")).toBeNull();
    expect(geocodeCidade(indice, "Camaçari", "SP")).toBeNull();
    expect(geocodeCidade(indice, "")).toBeNull();
    expect(geocodeCidade(indice, null)).toBeNull();
  });

  it("resolve capitais em coordenadas coerentes", () => {
    expect(geocodeCidade(indice, "São Paulo", "SP")).toMatchObject({ uf: "SP" });
    const sp = geocodeCidade(indice, "São Paulo", "SP")!;
    expect(sp.lat).toBeCloseTo(-23.53, 1);
    expect(sp.lng).toBeCloseTo(-46.64, 1);
  });
});
