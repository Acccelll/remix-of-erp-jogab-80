import { describe, expect, it } from "vitest";

import {
  extensoesEfetivas,
  isDuplicado,
  nomeExibivel,
  ordenarVinculos,
  painesDoCard,
  resumoDosVinculos,
  rotuloSituacao,
  validarNovoVinculo,
  vinculosAtivos,
} from "@/lib/quadros/extensoes/vinculos";
import type { BoardExtensao, CardVinculo } from "@/lib/quadros/extensoes/tipos";
import { extensaoSuportaEntidade, getExtensao } from "@/lib/quadros/extensoes/registry";

function v(p: Partial<CardVinculo> = {}): CardVinculo {
  return {
    id: p.id ?? "l1",
    extensao_codigo: p.extensao_codigo ?? "obra",
    entity_type: p.entity_type ?? "obra",
    entity_id: p.entity_id ?? "e1",
    relationship_type: p.relationship_type ?? "relacionado",
    is_primary: p.is_primary ?? false,
    display_order: p.display_order ?? 0,
    situacao: p.situacao ?? "ok",
    entidade_nome: p.entidade_nome ?? "Obra X",
    entidade_disponivel: p.entidade_disponivel ?? true,
    entidade_arquivada: p.entidade_arquivada ?? false,
    empresa_id: p.empresa_id ?? null,
    acesso_permitido: p.acesso_permitido ?? true,
    created_by: null,
    created_by_nome: null,
    created_at: p.created_at ?? "2026-01-01T00:00:00Z",
    archived_at: p.archived_at ?? null,
  };
}

const bx = (codigo: string, o: Partial<BoardExtensao> = {}): BoardExtensao => ({
  id: codigo,
  board_id: "b1",
  extensao_codigo: codigo,
  ativo: o.ativo ?? true,
  mostrar_resumo: o.mostrar_resumo ?? true,
  ordem: o.ordem ?? 0,
  config: {},
});

describe("registry", () => {
  it("conhece as extensões da Etapa 2", () => {
    expect(getExtensao("obra")?.nome).toBe("Obras");
    expect(extensaoSuportaEntidade("obra", "usuario")).toBe(false);
    expect(extensaoSuportaEntidade("pessoas", "usuario")).toBe(true);
  });
});

describe("validarNovoVinculo", () => {
  const ctx = { vinculosAtuais: [], extensoesAtivas: ["obra"], podeEditar: true };

  it("aceita vínculo válido", () => {
    expect(
      validarNovoVinculo({ extensao_codigo: "obra", entity_type: "obra", entity_id: "e1" }, ctx).ok,
    ).toBe(true);
  });

  it("bloqueia sem permissão", () => {
    const r = validarNovoVinculo(
      { extensao_codigo: "obra", entity_type: "obra", entity_id: "e1" },
      { ...ctx, podeEditar: false },
    );
    expect(r.ok).toBe(false);
  });

  it("bloqueia extensão inativa no quadro", () => {
    const r = validarNovoVinculo(
      { extensao_codigo: "obra", entity_type: "obra", entity_id: "e1" },
      { ...ctx, extensoesAtivas: [] },
    );
    expect(r.motivo).toMatch(/não está ativa/);
  });

  it("bloqueia tipo de entidade incompatível", () => {
    const r = validarNovoVinculo(
      { extensao_codigo: "obra", entity_type: "usuario", entity_id: "e1" },
      ctx,
    );
    expect(r.ok).toBe(false);
  });

  it("bloqueia duplicidade", () => {
    const r = validarNovoVinculo(
      { extensao_codigo: "obra", entity_type: "obra", entity_id: "e1" },
      { ...ctx, vinculosAtuais: [v()] },
    );
    expect(r.motivo).toMatch(/já existe/);
  });

  it("não considera duplicado um vínculo arquivado", () => {
    expect(
      isDuplicado([v({ archived_at: "2026-01-02T00:00:00Z" })], {
        extensao_codigo: "obra",
        entity_type: "obra",
        entity_id: "e1",
      }),
    ).toBe(false);
  });
});

describe("ordenação e situação", () => {
  it("ativos primeiro, principal no topo", () => {
    const lista = [
      v({ id: "a", archived_at: "2026-01-03T00:00:00Z" }),
      v({ id: "b" }),
      v({ id: "c", is_primary: true }),
    ];
    expect(ordenarVinculos(lista).map((x) => x.id)).toEqual(["c", "b", "a"]);
    expect(vinculosAtivos(lista)).toHaveLength(2);
  });

  it("classifica entidade indisponível como quebrado", () => {
    expect(rotuloSituacao(v({ entidade_disponivel: false })).situacao).toBe("quebrado");
    expect(rotuloSituacao(v({ entidade_arquivada: true })).situacao).toBe("arquivada");
    expect(rotuloSituacao(v()).situacao).toBe("ok");
  });

  it("não vaza nome de entidade sem acesso", () => {
    expect(nomeExibivel(v({ acesso_permitido: false }))).toBe("Restrito");
  });
});

describe("resumo e painéis", () => {
  it("respeita limite e flag mostrar_resumo", () => {
    const links = [
      v({ id: "1", entity_id: "e1" }),
      v({ id: "2", entity_id: "e2" }),
      v({ id: "3", entity_id: "e3" }),
      v({ id: "4", entity_id: "e4" }),
    ];
    expect(resumoDosVinculos(links, [bx("obra")])).toHaveLength(3);
    expect(resumoDosVinculos(links, [bx("obra", { mostrar_resumo: false })])).toHaveLength(0);
  });

  it("ordena painéis pela ordem do quadro", () => {
    expect(painesDoCard([bx("cronograma", { ordem: 1 }), bx("obra", { ordem: 2 })])).toEqual([
      "cronograma",
      "obra",
    ]);
  });

  it("ignora extensões desativadas", () => {
    expect(painesDoCard([bx("obra", { ativo: false })])).toEqual([]);
  });

  it("soma extensões padrão do tipo de card", () => {
    expect(extensoesEfetivas([bx("obra")], ["pessoas"]).sort()).toEqual(["obra", "pessoas"]);
  });
});
