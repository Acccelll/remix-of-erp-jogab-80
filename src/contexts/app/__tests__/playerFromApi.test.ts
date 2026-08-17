// Fase 2 (permissões) — round-trip da matriz: o que a Permissões salva
// precisa voltar do api.php pelo playerFromApi e derivar o mesmo acessos.
import { describe, expect, it } from "vitest";
import { playerFromApi } from "@/contexts/app/mappers";
import { acessosDerivadosDeMatriz } from "@/lib/authz/paginas";

const base = { id: 7, login: "ana", email: "", is_gm: 0, acessos: { obras_div: "visualizar" } };

describe("playerFromApi — matrizPermissoes/papeisPermissao", () => {
  it("lê os campos como objeto (PHP já decodificado)", () => {
    const p = playerFromApi({
      ...base,
      matrizPermissoes: { "/obras": { V: true } },
      papeisPermissao: { aprovarFinanceiro: true },
    });
    expect(p.matrizPermissoes).toEqual({ "/obras": { V: true } });
    expect(p.papeisPermissao).toEqual({ aprovarFinanceiro: true });
  });

  it("lê os campos como string JSON (defensivo) e aceita snake_case", () => {
    const p = playerFromApi({
      ...base,
      matriz_permissoes: JSON.stringify({ "/obras": { V: true, E: true } }),
      papeis_permissao: JSON.stringify({ setores: ["engenharia"] }),
    });
    expect(p.matrizPermissoes).toEqual({ "/obras": { V: true, E: true } });
    expect(p.papeisPermissao).toEqual({ setores: ["engenharia"] });
  });

  it("banco sem a migração: campos ausentes viram undefined (fallback legado)", () => {
    const p = playerFromApi(base);
    expect(p.matrizPermissoes).toBeUndefined();
    expect(p.papeisPermissao).toBeUndefined();
  });

  it("JSON inválido não derruba o mapper", () => {
    const p = playerFromApi({ ...base, matriz_permissoes: "{oops" });
    expect(p.matrizPermissoes).toBeUndefined();
  });
});

describe("round-trip matriz → acessos derivado (contrato do salvar da Permissões)", () => {
  it("matriz com V numa página do módulo deriva ao menos 'visualizar' na PageKey", () => {
    const matriz = { "/obras": { V: true } };
    const acessos = acessosDerivadosDeMatriz(matriz, {});
    expect(acessos.obras_div === "visualizar" || acessos.obras_div === "editar").toBe(true);
  });

  it("papéis especiais elevam o nível financeiro/compras", () => {
    const acessos = acessosDerivadosDeMatriz({}, { aprovarFinanceiro: true });
    expect(acessos.financeiro).toBe("financeiro");
  });
});
