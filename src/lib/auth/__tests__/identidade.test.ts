import { describe, it, expect } from "vitest";
import { emailDoLogin, normalizarLogin } from "../identidade";

/**
 * O login do GM é a ponte entre dois mundos: o backend PHP (usuários,
 * permissões) e o Supabase (quadros, cards). Ele vem digitado por gente, com
 * acento e maiúscula; do outro lado vira e-mail, que é ASCII. Quando as duas
 * pontas divergem, o usuário entra no sistema mas não enxerga dado nenhum — e
 * sem erro visível. Foi o que aconteceu com "Letícia.Flink".
 */
describe("normalizarLogin", () => {
  it("ignora caixa, pontuação e espaço", () => {
    expect(normalizarLogin("Adriana.Penso")).toBe(normalizarLogin("adriana penso"));
    expect(normalizarLogin("gabriel_rodrigues")).toBe(normalizarLogin("Gabriel.Rodrigues"));
  });

  it("ignora acento", () => {
    // O perfil guarda o login do GM ("Letícia.Flink"); a comparação costuma ser
    // contra o prefixo do e-mail, que nunca tem acento.
    expect(normalizarLogin("Letícia.Flink")).toBe(normalizarLogin("leticia.flink"));
    expect(normalizarLogin("Célia")).toBe(normalizarLogin("celia"));
  });

  it("trata vazio e nulo sem quebrar", () => {
    expect(normalizarLogin(null)).toBe("");
    expect(normalizarLogin(undefined)).toBe("");
    expect(normalizarLogin("   ")).toBe("");
  });
});

describe("emailDoLogin", () => {
  it("mantém o padrão Nome.Sobrenome, em ASCII", () => {
    expect(emailDoLogin("Letícia.Flink")).toBe("leticia.flink@planifik.local");
    expect(emailDoLogin("Célia")).toBe("celia@planifik.local");
  });

  it("não mexe em quem já era ASCII", () => {
    // Contas existentes não podem mudar de endereço com esta correção.
    expect(emailDoLogin("Adriana.Penso")).toBe("adriana.penso@planifik.local");
    expect(emailDoLogin("Cappucceno")).toBe("cappucceno@planifik.local");
    expect(emailDoLogin("Leonardo.Sant'ana")).toBe("leonardo.sant'ana@planifik.local");
    expect(emailDoLogin("  Nando  ")).toBe("nando@planifik.local");
  });

  it("gera o mesmo endereço que a edge function", () => {
    // Cópia literal da regra em supabase/functions/sync-player-auth/index.ts.
    const comoNaEdgeFunction = (login: string) =>
      `${login.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")}@planifik.local`;
    for (const login of ["Letícia.Flink", "Célia", "Adriana.Penso", "Irineo.Beig", "Lu"]) {
      expect(emailDoLogin(login)).toBe(comoNaEdgeFunction(login));
    }
  });
});
