import { describe, expect, it } from "vitest";
import { __internal } from "@/hooks/rh/useLogisticaPontos";
import { chaveMunicipio, slugCidade } from "@/lib/logistica/normalize";
import type { IndiceMunicipios, Municipio } from "@/lib/logistica/municipios";
import type { Colaborador, Obra } from "@/types";

const { localizarColaborador, localizarObra } = __internal;

const CAMACARI: Municipio = { nome: "Camaçari", uf: "BA", lat: -12.6996, lng: -38.3263 };
const SAO_PAULO: Municipio = { nome: "São Paulo", uf: "SP", lat: -23.5329, lng: -46.6395 };
const BOM_JESUS_PI: Municipio = { nome: "Bom Jesus", uf: "PI", lat: -9.0714, lng: -44.3586 };
const BOM_JESUS_RS: Municipio = { nome: "Bom Jesus", uf: "RS", lat: -28.6683, lng: -50.4292 };

/** Índice mínimo com os municípios que os casos abaixo usam. */
function indiceDeTeste(municipios: Municipio[]): IndiceMunicipios {
  const porChave = new Map<string, Municipio>();
  const porNome = new Map<string, Municipio[]>();
  for (const m of municipios) {
    porChave.set(chaveMunicipio(m.nome, m.uf), m);
    const slug = slugCidade(m.nome);
    porNome.set(slug, [...(porNome.get(slug) ?? []), m]);
  }
  return { porChave, porNome, todos: municipios };
}

const indice = indiceDeTeste([CAMACARI, SAO_PAULO, BOM_JESUS_PI, BOM_JESUS_RS]);

const colab = (p: Partial<Colaborador>): Colaborador =>
  ({ id: "c1", nome: "Fulano", ativo: true, cidade: "", ...p }) as Colaborador;

const obra = (p: Partial<Obra>): Obra =>
  ({ id: "o1", nome: "Obra", cliente: "", ativa: true, ...p }) as Obra;

describe("useLogisticaPontos · precedência de coordenadas do colaborador", () => {
  it("usa a coordenada gravada acima de tudo", () => {
    const ponto = localizarColaborador(
      colab({ latitude: -13.5, longitude: -39.1, cidade: "Camaçari", uf: "BA" }),
      indice,
    );
    expect(ponto.coord).toEqual({ lat: -13.5, lng: -39.1 });
    expect(ponto.origem).toBe("exata");
  });

  it("cai para cidade + UF quando não há coordenada gravada", () => {
    const ponto = localizarColaborador(colab({ cidade: "Camaçari", uf: "BA" }), indice);
    expect(ponto.coord).toEqual({ lat: CAMACARI.lat, lng: CAMACARI.lng });
    expect(ponto.origem).toBe("cidade");
    expect(ponto.rotuloLocal).toBe("Camaçari/BA");
  });

  it("resolve sem UF quando o nome é único", () => {
    const ponto = localizarColaborador(colab({ cidade: "Camaçari" }), indice);
    expect(ponto.origem).toBe("cidade");
  });

  it("não chuta entre homônimos quando falta a UF", () => {
    expect(localizarColaborador(colab({ cidade: "Bom Jesus" }), indice).coord).toBeNull();
    expect(localizarColaborador(colab({ cidade: "Bom Jesus", uf: "RS" }), indice).coord).toEqual({
      lat: BOM_JESUS_RS.lat,
      lng: BOM_JESUS_RS.lng,
    });
  });

  it("ignora coordenada 0,0 — é campo em branco, não o Golfo da Guiné", () => {
    const ponto = localizarColaborador(
      colab({ latitude: 0, longitude: 0, cidade: "Camaçari", uf: "BA" }),
      indice,
    );
    expect(ponto.origem).toBe("cidade");
  });

  it("devolve coord nula quando não há como localizar, preservando o rótulo", () => {
    const ponto = localizarColaborador(colab({ cidade: "Cidade Inexistente", uf: "BA" }), indice);
    expect(ponto.coord).toBeNull();
    expect(ponto.origem).toBeNull();
    expect(ponto.rotuloLocal).toBe("Cidade Inexistente/BA");
  });

  it("resolve o par combinado numa string só, como a base guarda", () => {
    // "Rio Claro/SP" num campo de cidade era o que fazia 96 de 97
    // colaboradores sumirem do mapa.
    const ponto = localizarColaborador(colab({ cidade: "Camaçari/BA" }), indice);
    expect(ponto.coord).toEqual({ lat: CAMACARI.lat, lng: CAMACARI.lng });
    expect(ponto.origem).toBe("cidade");
    expect(ponto.rotuloLocal).toBe("Camaçari/BA");
  });

  it("usa a faixa do CEP para desempatar homônimo, sem tocar na rede", () => {
    // Bom Jesus existe em PI e RS: sozinho não resolve.
    expect(localizarColaborador(colab({ cidade: "Bom Jesus" }), indice).coord).toBeNull();
    // 64000-000 é faixa do PI; 95000-000 é do RS.
    expect(
      localizarColaborador(colab({ cidade: "Bom Jesus", cep: "64900-000" }), indice).coord,
    ).toEqual({ lat: BOM_JESUS_PI.lat, lng: BOM_JESUS_PI.lng });
    expect(
      localizarColaborador(colab({ cidade: "Bom Jesus", cep: "95000-000" }), indice).coord,
    ).toEqual({ lat: BOM_JESUS_RS.lat, lng: BOM_JESUS_RS.lng });
  });

  it("a UF do cadastro vence a deduzida do CEP", () => {
    // CEP de SP, mas o cadastro diz PI: o dado explícito manda.
    const ponto = localizarColaborador(
      colab({ cidade: "Bom Jesus", uf: "PI", cep: "13400-000" }),
      indice,
    );
    expect(ponto.coord).toEqual({ lat: BOM_JESUS_PI.lat, lng: BOM_JESUS_PI.lng });
  });

  it("distingue quem não tem cidade de quem tem cidade irreconhecível", () => {
    expect(localizarColaborador(colab({ cidade: "" }), indice).motivoSemLocal).toBe("sem-cadastro");
    expect(localizarColaborador(colab({ cidade: "   " }), indice).motivoSemLocal).toBe(
      "sem-cadastro",
    );
    // Erro de digitação: a cidade existe, a grafia é que não bate.
    expect(localizarColaborador(colab({ cidade: "Chaqueada/SP" }), indice).motivoSemLocal).toBe(
      "nao-reconhecida",
    );
  });

  it("não marca motivo em quem foi localizado", () => {
    expect(
      localizarColaborador(colab({ cidade: "Camaçari", uf: "BA" }), indice).motivoSemLocal,
    ).toBeUndefined();
  });
});

describe("useLogisticaPontos · precedência de coordenadas da obra", () => {
  it("usa a coordenada gravada acima de tudo", () => {
    const ponto = localizarObra(
      obra({ latitude: -12.7, longitude: -38.3, cidade: "São Paulo", uf: "SP" }),
      indice,
    );
    expect(ponto.coord).toEqual({ lat: -12.7, lng: -38.3 });
    expect(ponto.origem).toBe("exata");
  });

  it("prefere cidade/UF do cadastro ao texto livre de `local`", () => {
    const ponto = localizarObra(
      obra({ cidade: "Camaçari", uf: "BA", local: "São Paulo/SP" }),
      indice,
    );
    expect(ponto.coord).toEqual({ lat: CAMACARI.lat, lng: CAMACARI.lng });
    expect(ponto.origem).toBe("cidade");
  });

  it("extrai a cidade do campo livre `local` quando o cadastro está vazio", () => {
    const ponto = localizarObra(obra({ local: "Camaçari/BA" }), indice);
    expect(ponto.coord).toEqual({ lat: CAMACARI.lat, lng: CAMACARI.lng });
    expect(ponto.origem).toBe("local");
    expect(ponto.rotuloLocal).toBe("Camaçari/BA");
  });

  it("aceita as variações de escrita do campo `local`", () => {
    for (const local of ["Camaçari - BA", "Camaçari, BA", "Polo — Camaçari/BA", "camacari/ba"]) {
      expect(localizarObra(obra({ local }), indice).origem, local).toBe("local");
    }
  });

  it("devolve coord nula quando `local` não é parseável, mantendo o texto como rótulo", () => {
    const ponto = localizarObra(obra({ local: "Km 42 da rodovia" }), indice);
    expect(ponto.coord).toBeNull();
    expect(ponto.rotuloLocal).toBe("Km 42 da rodovia");
    expect(ponto.motivoSemLocal).toBe("nao-reconhecida");
  });

  it("marca obra sem nenhum dado de local como sem-cadastro", () => {
    expect(localizarObra(obra({}), indice).motivoSemLocal).toBe("sem-cadastro");
  });
});
