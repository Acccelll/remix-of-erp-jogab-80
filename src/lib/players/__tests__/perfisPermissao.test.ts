import { describe, expect, it } from "vitest";
import {
  acessosVazios,
  aplicarPerfilEmPlayer,
  criarPerfil,
  normalizarAcessos,
  PAGINAS_PERMISSAO,
  perfilAPartirDePlayer,
  validarPerfil,
} from "../perfisPermissao";

describe("perfisPermissao", () => {
  it("acessosVazios cobre todas as páginas com 'nenhum'", () => {
    const v = acessosVazios();
    for (const k of PAGINAS_PERMISSAO) expect(v[k]).toBe("nenhum");
  });

  it("normalizarAcessos preenche páginas ausentes", () => {
    const n = normalizarAcessos({ financeiro: "financeiro" });
    expect(n.financeiro).toBe("financeiro");
    expect(n.rh).toBe("nenhum");
  });

  it("validarPerfil rejeita nome curto ou duplicado", () => {
    const existente = criarPerfil({ nome: "Gestor", acessos: {} });
    expect(validarPerfil({ nome: "a", acessos: {} }, []).ok).toBe(false);
    expect(validarPerfil({ nome: "gestor", acessos: {} }, [existente]).ok).toBe(false);
    expect(validarPerfil({ nome: "Novo", acessos: {} }, [existente]).ok).toBe(true);
  });

  it("criarPerfil normaliza acessos e gera id/timestamps", () => {
    const p = criarPerfil({ nome: "Suprimentos", acessos: { almoxarifado: "compras" } });
    expect(p.acessos.almoxarifado).toBe("compras");
    expect(p.acessos.rh).toBe("nenhum");
    expect(p.id).toMatch(/^perfil_/);
    expect(p.createdAt).toBe(p.updatedAt);
  });

  it("perfilAPartirDePlayer usa os acessos do player", () => {
    const input = perfilAPartirDePlayer(
      { acessos: normalizarAcessos({ crm: "editar" }) },
      "CRM Ops",
    );
    expect(input.acessos.crm).toBe("editar");
  });

  it("aplicarPerfilEmPlayer substituir troca o mapa inteiro", () => {
    const perfil = criarPerfil({ nome: "X", acessos: { financeiro: "visualizar" } });
    const out = aplicarPerfilEmPlayer(
      { acessos: normalizarAcessos({ financeiro: "financeiro", rh: "editar" }) },
      perfil,
      "substituir",
    );
    expect(out.acessos.financeiro).toBe("visualizar");
    expect(out.acessos.rh).toBe("nenhum");
  });

  it("aplicarPerfilEmPlayer mesclar não rebaixa acesso já concedido", () => {
    const perfil = criarPerfil({ nome: "X", acessos: { financeiro: "visualizar" } });
    const out = aplicarPerfilEmPlayer(
      { acessos: normalizarAcessos({ financeiro: "financeiro" }) },
      perfil,
      "mesclar",
    );
    expect(out.acessos.financeiro).toBe("financeiro");
  });
});
