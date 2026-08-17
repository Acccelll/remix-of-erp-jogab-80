// Fase 2 (permissões) — contrato do payload de usuarios: a matriz fina e os
// papéis especiais precisam chegar ao api.php (antes eram descartados aqui).
import { describe, expect, it } from "vitest";
import { playerPayload } from "@/hooks/usePlayers";

describe("playerPayload", () => {
  it("encaminha matrizPermissoes e papeisPermissao quando presentes", () => {
    const payload = playerPayload({
      matrizPermissoes: { "/obras": { V: true, E: true } },
      papeisPermissao: { aprovarCompras: true, setores: ["fiscalizacao"] },
      acessos: { obras_div: "editar" } as any,
    });
    expect(payload.matrizPermissoes).toEqual({ "/obras": { V: true, E: true } });
    expect(payload.papeisPermissao).toEqual({ aprovarCompras: true, setores: ["fiscalizacao"] });
    expect(payload.acessos).toEqual({ obras_div: "editar" });
  });

  it("omite os campos de permissão quando não fornecidos (update parcial)", () => {
    const payload = playerPayload({ login: "x", senha: "y", email: "z" });
    expect(payload).toEqual({ login: "x", senha: "y", email: "z" });
    expect("matrizPermissoes" in payload).toBe(false);
    expect("papeisPermissao" in payload).toBe(false);
  });

  it("mantém o alias acesso_contratos derivado de acessos", () => {
    const payload = playerPayload({ acessos: { contratos: "editar" } as any });
    expect(payload.acesso_contratos).toBe("editar");
  });
});
