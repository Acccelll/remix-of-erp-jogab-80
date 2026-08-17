import { describe, expect, it } from "vitest";
import {
  analisarImportacaoPerfis,
  aplicarImportacaoPerfis,
  atualizarPerfil,
  CHAVES_COL_MAP,
  criarPerfil,
  detalharDiffPerfis,
  diffPerfis,
  mergePerfilPorCampos,
  exportarPerfisJson,
  importarPerfisJson,
  perfilAPartirDeDiagnostico,
  removerPerfil,
  sugerirPerfilPara,
  upsertPerfil,
  validarPerfil,
} from "../layoutPerfis";
import type { BmsWorkbook } from "../excel";

const colunas = Object.fromEntries(CHAVES_COL_MAP.map((k, i) => [k, i])) as any;

describe("BMS layout perfis", () => {
  it("valida input e cria perfil com id/timestamp", () => {
    expect(() =>
      validarPerfil({ nome: "", headerRow: 7, colunas } as any),
    ).toThrow(/[Nn]ome/);
    const p = criarPerfil({ nome: "Jogab", cliente: "ACME", headerRow: 7, colunas } as any,
      () => new Date("2026-07-14T00:00:00Z"));
    expect(p.id).toMatch(/^[a-z0-9]{6,}$/);
    expect(p.criadoEm).toBe("2026-07-14T00:00:00.000Z");
    expect(p.colunas.item).toBe(0);
  });

  it("extrai perfil de diagnóstico", () => {
    const p = perfilAPartirDeDiagnostico(
      { headerRow: 7, colunas, rotulosCabecalho: [], rotulosSubcabecalho: [] },
      "novo",
      "ACME",
    );
    expect(p.headerRow).toBe(7);
    expect(p.colunas.sv).toBe(13);
  });

  it("upsert e remover", () => {
    const p = criarPerfil({ nome: "a", headerRow: 7, colunas } as any);
    let l = upsertPerfil([], p);
    expect(l).toHaveLength(1);
    l = upsertPerfil(l, { ...p, nome: "b" });
    expect(l[0].nome).toBe("b");
    expect(removerPerfil(l, p.id)).toHaveLength(0);
  });

  it("sugere perfil por cliente e devolve null se não houver ignoradas", () => {
    const p = criarPerfil({ nome: "x", cliente: "ACME", headerRow: 7, colunas } as any);
    const wb: BmsWorkbook = {
      arquivoNome: "x", sheets: [{ sheetName: "s", numero: "01", ordem: 1,
        total_medicao: 0, itens: [], cliente_unidade: "acme" } as any],
      ignoradas: [{ sheetName: "y", motivo: "z" }],
    };
    expect(sugerirPerfilPara(wb, [p])?.id).toBe(p.id);
    expect(sugerirPerfilPara({ ...wb, ignoradas: [] }, [p])).toBeNull();
  });

  it("atualiza perfil validando patch parcial", () => {
    const p = criarPerfil({ nome: "orig", headerRow: 7, colunas } as any);
    const lista = [p];
    const upd = atualizarPerfil(lista, p.id, {
      nome: "novo",
      headerRow: 9,
      colunas: { item: 2 },
    });
    expect(upd[0].nome).toBe("novo");
    expect(upd[0].headerRow).toBe(9);
    expect(upd[0].colunas.item).toBe(2);
    expect(upd[0].colunas.desc).toBe(1); // preserva demais
    expect(() => atualizarPerfil(lista, p.id, { nome: "" })).toThrow(/[Nn]ome/);
    expect(() => atualizarPerfil(lista, "inexistente", { nome: "x" })).toThrow();
  });

  it("exporta e importa perfis em JSON versionado com upsert", () => {
    const p = criarPerfil(
      { nome: "Jogab", cliente: "ACME", headerRow: 7, colunas } as any,
      () => new Date("2026-07-14T00:00:00Z"),
    );
    const json = exportarPerfisJson([p], () => new Date("2026-07-15T00:00:00Z"));
    expect(json).toContain("gestaobra.bms-layout-perfis");

    const atualizado = {
      ...p,
      nome: "Jogab revisado",
      versao: p.versao + 1,
      atualizadoEm: "2026-07-16T00:00:00.000Z",
    };
    const resultado = importarPerfisJson(exportarPerfisJson([atualizado]), [p]);
    expect(resultado.perfis).toHaveLength(1);
    expect(resultado.importados).toBe(0);
    expect(resultado.atualizados).toBe(1);
    expect(resultado.preservados).toBe(0);
    expect(resultado.perfis[0].nome).toBe("Jogab revisado");
  });

  it("preserva perfil local mais recente ao importar versão antiga", () => {
    const local = criarPerfil(
      { nome: "Local novo", headerRow: 7, colunas } as any,
      () => new Date("2026-07-20T00:00:00Z"),
    );
    const localBumpado = atualizarPerfil([local], local.id, { nome: "Local v2" },
      () => new Date("2026-07-21T00:00:00Z"))[0];
    const antigo = { ...local, nome: "Antigo" };
    const r = importarPerfisJson(exportarPerfisJson([antigo]), [localBumpado]);
    expect(r.preservados).toBe(1);
    expect(r.atualizados).toBe(0);
    expect(r.perfis[0].nome).toBe("Local v2");
    expect(r.perfis[0].versao).toBe(2);
  });

  it("rejeita JSON de perfis inválido", () => {
    expect(() => importarPerfisJson("{", [])).toThrow(/JSON/);
    expect(() => importarPerfisJson(JSON.stringify({ perfis: [{ nome: "x" }] }), [])).toThrow(
      /coluna/i,
    );
  });

  it("diffPerfis lista campos alterados", () => {
    const base = criarPerfil({ nome: "a", cliente: "X", headerRow: 7, colunas } as any);
    const outro = { ...base, nome: "b", colunas: { ...base.colunas, item: 99 } };
    const d = diffPerfis(base, outro);
    expect(d).toEqual(["nome", "colunas.item"]);
    expect(diffPerfis(base, base)).toEqual([]);
  });

  it("analisa e aplica importação com decisões manuais", () => {
    const local = criarPerfil({ nome: "Local", headerRow: 7, colunas } as any);
    const editado = { ...local, nome: "Do arquivo" };
    const novo = criarPerfil({ nome: "Novo", headerRow: 8, colunas } as any);
    const json = exportarPerfisJson([editado, novo, local]);
    const itens = analisarImportacaoPerfis(json, [local]);
    expect(itens.map((i) => i.status)).toEqual(["conflito", "novo", "identico"]);
    expect(itens[0].diff).toContain("nome");

    const r = aplicarImportacaoPerfis(
      [local],
      [
        { perfil: itens[0].perfil, acao: "preservar" },
        { perfil: itens[1].perfil, acao: "importar" },
      ],
    );
    expect(r.importados).toBe(1);
    expect(r.atualizados).toBe(0);
    expect(r.preservados).toBe(1);
    expect(r.perfis).toHaveLength(2);
    expect(r.perfis.find((p) => p.id === local.id)?.nome).toBe("Local");
  });

  it("detalha diff com valores lado a lado", () => {
    const a = criarPerfil({ nome: "A", cliente: "X", headerRow: 7, colunas } as any);
    const b = { ...a, nome: "B", headerRow: 9, colunas: { ...a.colunas, item: 42 } };
    const linhas = detalharDiffPerfis(a, b);
    expect(linhas).toEqual([
      { campo: "nome", atual: "A", importado: "B" },
      { campo: "headerRow", atual: "7", importado: "9" },
      { campo: "colunas.item", atual: "0", importado: "42" },
    ]);
  });

  it("mescla só campos escolhidos e bumpa versão", () => {
    const a = criarPerfil(
      { nome: "A", cliente: "X", headerRow: 7, colunas } as any,
      () => new Date("2026-07-14T00:00:00Z"),
    );
    const b = { ...a, nome: "B", headerRow: 9, colunas: { ...a.colunas, item: 42 } };
    const merged = mergePerfilPorCampos(a, b, ["nome", "colunas.item"],
      () => new Date("2026-07-15T00:00:00Z"));
    expect(merged.nome).toBe("B");
    expect(merged.headerRow).toBe(7); // preservado
    expect(merged.colunas.item).toBe(42);
    expect(merged.versao).toBe(2);
    expect(merged.atualizadoEm).toBe("2026-07-15T00:00:00.000Z");
  });

  it("aplicarImportacaoPerfis suporta ação mesclar", () => {
    const a = criarPerfil({ nome: "A", headerRow: 7, colunas } as any);
    const b = { ...a, nome: "B", headerRow: 9 };
    const r = aplicarImportacaoPerfis([a], [
      { perfil: b, acao: "mesclar", campos: ["nome"] },
    ]);
    expect(r.atualizados).toBe(1);
    expect(r.perfis[0].nome).toBe("B");
    expect(r.perfis[0].headerRow).toBe(7);
  });
});
