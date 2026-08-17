import { describe, expect, it } from "vitest";
import { aplicarMencao, extrairMencoes, mencaoEmCurso } from "@/lib/cards/mencoes";

describe("extrairMencoes", () => {
  it("retorna lista vazia para texto vazio ou sem @", () => {
    expect(extrairMencoes("")).toEqual([]);
    expect(extrairMencoes("oi tudo bem")).toEqual([]);
  });

  it("captura menção no início", () => {
    expect(extrairMencoes("@joao revisa isso")).toEqual(["joao"]);
  });

  it("captura menção no meio e final", () => {
    expect(extrairMencoes("cc @maria.silva por favor @ze_")).toEqual(["maria.silva", "ze_"]);
  });

  it("normaliza para minúsculo", () => {
    expect(extrairMencoes("@Joao @MARIA")).toEqual(["joao", "maria"]);
  });

  it("remove duplicadas preservando ordem", () => {
    expect(extrairMencoes("@a vai @b e @a de novo")).toEqual(["a", "b"]);
  });

  it("ignora @ colado em palavra (e-mail)", () => {
    expect(extrairMencoes("foo@bar.com não é menção")).toEqual([]);
  });

  it("respeita pontuação após o login", () => {
    expect(extrairMencoes("oi @joao, tudo bem? @maria!")).toEqual(["joao", "maria"]);
  });
});

describe("mencaoEmCurso", () => {
  it("detecta @ em digitação", () => {
    expect(mencaoEmCurso("oi @jo", 6)).toEqual({ inicio: 3, query: "jo" });
  });
  it("não detecta após espaço", () => {
    expect(mencaoEmCurso("@jo ", 4)).toBeNull();
  });
  it("@ no início conta", () => {
    expect(mencaoEmCurso("@", 1)).toEqual({ inicio: 0, query: "" });
  });
  it("não detecta dentro de e-mail", () => {
    expect(mencaoEmCurso("foo@bar", 7)).toBeNull();
  });
});

describe("aplicarMencao", () => {
  it("substitui token em curso pelo login completo + espaço", () => {
    const r = aplicarMencao("oi @jo", 6, "joao");
    expect(r.texto).toBe("oi @joao ");
    expect(r.cursor).toBe(9);
  });
  it("preserva texto após o cursor", () => {
    const r = aplicarMencao("oi @ma fim", 6, "maria");
    expect(r.texto).toBe("oi @maria  fim");
  });
});
