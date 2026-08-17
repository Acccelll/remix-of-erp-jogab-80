import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { chaveMunicipio, slugCidade } from "@/lib/logistica/normalize";
import { geocodeCidade, type IndiceMunicipios, type Municipio } from "@/lib/logistica/municipios";
import { ufPorCep } from "@/lib/logistica/cep-uf";

/**
 * Regressão contra os dados reais de produção.
 *
 * A primeira versão da tela posicionava 1 colaborador de 97 porque o campo
 * `cidade` guarda "Cidade/UF" numa string só. Um teste com casos inventados
 * não teria pego isso — só a base real pega. Por isso a fixture existe:
 * trava o resultado num número, não num exemplo isolado.
 *
 * A fixture é anônima (sem nome, CPF, id ou endereço) e tem o sufixo do CEP
 * zerado — só o prefixo importa para deduzir a UF.
 */
const fixture = JSON.parse(
  readFileSync(
    resolve(process.cwd(), "src/lib/logistica/__tests__/fixtures/colaboradores-cidades.json"),
    "utf-8",
  ),
) as { total: number; registros: { cidade: string; uf: string; cep: string }[] };

const arquivoMunicipios = JSON.parse(
  readFileSync(resolve(process.cwd(), "public/geo/municipios-br.json"), "utf-8"),
) as { municipios: [string, string, number, number][] };

const indice: IndiceMunicipios = (() => {
  const porChave = new Map<string, Municipio>();
  const porNome = new Map<string, Municipio[]>();
  const todos: Municipio[] = [];
  for (const [nome, uf, lat, lng] of arquivoMunicipios.municipios) {
    const m = { nome, uf, lat, lng } as Municipio;
    todos.push(m);
    porChave.set(chaveMunicipio(nome, uf), m);
    const slug = slugCidade(nome);
    porNome.set(slug, [...(porNome.get(slug) ?? []), m]);
  }
  return { porChave, porNome, todos };
})();

/** Mesma cadeia de precedência de `localizarColaborador`. */
const localiza = (r: { cidade: string; uf: string; cep: string }) =>
  geocodeCidade(indice, r.cidade, r.uf) ?? geocodeCidade(indice, r.cidade, ufPorCep(r.cep));

describe("logistica · geocoding contra a base real", () => {
  const comCidade = fixture.registros.filter((r) => r.cidade);
  const resolvidos = fixture.registros.filter((r) => localiza(r) !== null);

  it("a fixture reflete a base observada", () => {
    expect(fixture.total).toBe(97);
    expect(comCidade).toHaveLength(55);
  });

  it("posiciona ao menos 53 dos 97 colaboradores ativos", () => {
    // Antes da correção era 1. Se esse número cair, o parsing tolerante
    // regrediu — é o teste que guarda o bug original.
    expect(resolvidos.length).toBeGreaterThanOrEqual(53);
  });

  it("resolve todos os cadastros com cidade preenchida, menos os 2 com erro de digitação", () => {
    const falhas = comCidade.filter((r) => localiza(r) === null).map((r) => r.cidade);
    // 'Chaqueada/SP' é Charqueada; 'SANTA QUITERIA DO MARANHÃ-MA' perdeu o "o".
    // Não são corrigíveis por código sem arriscar posicionar na cidade errada.
    expect(falhas).toHaveLength(2);
    expect(falhas.every((c) => /chaqueada|maranh/i.test(c))).toBe(true);
  });

  it("resolve o formato combinado que o cadastro por CEP produz", () => {
    expect(geocodeCidade(indice, "Rio Claro/SP")).toMatchObject({ nome: "Rio Claro", uf: "SP" });
    expect(geocodeCidade(indice, "Piracicaba/SP")).toMatchObject({ nome: "Piracicaba" });
    expect(geocodeCidade(indice, "Santa Mariana/PR")).toMatchObject({ uf: "PR" });
    expect(geocodeCidade(indice, "PRADÓPOLIS/SP")).toMatchObject({ nome: "Pradópolis" });
    expect(geocodeCidade(indice, "Chapadão do Céu/GO")).toMatchObject({ uf: "GO" });
    expect(geocodeCidade(indice, "Chapadão do Sul/MS")).toMatchObject({ uf: "MS" });
  });

  it("usa o CEP para desempatar homônimo sem UF, e só nesse caso", () => {
    // "Rio Claro" existe em SP e RJ: sozinho não resolve.
    expect(geocodeCidade(indice, "Rio Claro")).toBeNull();
    // Com o CEP, resolve — sem nenhuma requisição de rede.
    expect(localiza({ cidade: "Rio Claro", uf: "", cep: "13503-000" })).toMatchObject({
      nome: "Rio Claro",
      uf: "SP",
    });
    // E respeita a outra ponta do desempate.
    expect(localiza({ cidade: "Rio Claro", uf: "", cep: "23970-000" })).toMatchObject({
      uf: "RJ",
    });
  });

  it("a UF explícita do cadastro vence a deduzida do CEP", () => {
    // Alguém cadastrado em Santa Mariana/PR mas com CEP de SP (mudou-se, ou
    // o CEP é do endereço antigo) continua indo para o PR do cadastro.
    expect(localiza({ cidade: "Santa Mariana/PR", uf: "", cep: "13400-000" })).toMatchObject({
      uf: "PR",
    });
  });

  it("resolve todos os municípios com hífen no nome, com e sem UF colada", () => {
    // 27 municípios têm hífen no nome próprio. Um parser que cortasse no
    // primeiro separador transformaria "Xique-Xique/BA" em "Xique"/BA.
    const comHifen = arquivoMunicipios.municipios.filter(([nome]) => nome.includes("-"));
    expect(comHifen.length).toBeGreaterThanOrEqual(27);

    const naoResolvidos = comHifen.filter(([nome, uf]) => {
      const soNome = geocodeCidade(indice, nome);
      const comUfColada = geocodeCidade(indice, `${nome}/${uf}`);
      return !comUfColada || comUfColada.nome !== nome || (soNome && soNome.nome !== nome);
    });
    expect(naoResolvidos.map(([n, u]) => `${n}/${u}`)).toEqual([]);
  });

  it("descasca prefixo descritivo sem sacrificar o nome fiel", () => {
    expect(geocodeCidade(indice, "Obra do Polo — Camaçari/BA")).toMatchObject({
      nome: "Camaçari",
      uf: "BA",
    });
    expect(geocodeCidade(indice, "Xique-Xique/BA")).toMatchObject({ nome: "Xique-Xique" });
  });

  it("nenhum cadastro é posicionado numa UF que contradiz o texto", () => {
    for (const r of comCidade) {
      const m = localiza(r);
      if (!m) continue;
      const ufNoTexto = r.cidade.match(/[/\-,]\s*([A-Za-z]{2})\s*$/)?.[1]?.toUpperCase();
      if (ufNoTexto) expect(m.uf, `${r.cidade} caiu em ${m.uf}`).toBe(ufNoTexto);
    }
  });

  it("chega no mesmo resultado antes e depois da migration de normalização", () => {
    // Réplica dos dois UPDATEs de
    // migrations/2026_07_27_normaliza_cidade_uf_colaboradores_mysql.sql.
    // Se o parser e o dado normalizado divergissem, aplicar a migration
    // mudaria silenciosamente quem aparece no mapa.
    const UFS_VALIDAS = new Set(
      "AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO".split(" "),
    );
    const normalizados = fixture.registros.map((r) => {
      const sufixo = r.cidade.split("/").pop()?.trim().toUpperCase() ?? "";
      if (!r.uf && r.cidade.includes("/") && UFS_VALIDAS.has(sufixo)) {
        return { ...r, cidade: r.cidade.split("/")[0].trim(), uf: sufixo };
      }
      return r;
    });

    const depois = normalizados.filter((r) => localiza(r) !== null);
    expect(depois.length).toBe(resolvidos.length);

    // E cada um cai exatamente no mesmo município.
    for (let i = 0; i < fixture.registros.length; i++) {
      expect(localiza(normalizados[i])?.nome ?? null).toBe(
        localiza(fixture.registros[i])?.nome ?? null,
      );
    }
  });
});
