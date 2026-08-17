import { describe, it, expect } from "vitest";
import {
  isSecaoVisivel,
  secoesAdicionaveis,
  SECOES_OPCIONAIS,
  type SecaoOpcional,
  type VisibilidadeInput,
} from "../secoesVisiveis";

const vazio = (): VisibilidadeInput => ({ temDado: false, registrada: false });

function todasVazias(): Record<SecaoOpcional, VisibilidadeInput> {
  return Object.fromEntries(SECOES_OPCIONAIS.map((s) => [s, vazio()])) as Record<
    SecaoOpcional,
    VisibilidadeInput
  >;
}

describe("secoesVisiveis", () => {
  it("oculta tudo quando card é novo e sem dado", () => {
    for (const s of SECOES_OPCIONAIS) {
      expect(isSecaoVisivel(s, vazio())).toBe(false);
    }
  });

  it("mostra quando tem dado", () => {
    expect(isSecaoVisivel("checklist", { temDado: true, registrada: false })).toBe(true);
    expect(isSecaoVisivel("anexos", { temDado: true, registrada: false })).toBe(true);
  });

  it("mostra quando registrada manualmente", () => {
    expect(isSecaoVisivel("etiquetas", { temDado: false, registrada: true })).toBe(true);
  });

  it("vínculo de cronograma força as seções 'datas' e 'cronograma'", () => {
    expect(
      isSecaoVisivel("datas", { temDado: false, registrada: false, cronogramaItemId: "abc" }),
    ).toBe(true);
    expect(
      isSecaoVisivel("cronograma", { temDado: false, registrada: false, cronogramaItemId: "abc" }),
    ).toBe(true);
    expect(
      isSecaoVisivel("lembrete", { temDado: false, registrada: false, cronogramaItemId: "abc" }),
    ).toBe(false);
  });

  it("secoesAdicionaveis lista só as ocultas", () => {
    const todas = todasVazias();
    expect(secoesAdicionaveis(todas)).toEqual([...SECOES_OPCIONAIS]);

    todas.checklist = { temDado: true, registrada: false };
    todas.datas = { temDado: false, registrada: true };
    const restantes = secoesAdicionaveis(todas);
    expect(restantes).not.toContain("checklist");
    expect(restantes).not.toContain("datas");
    expect(restantes).toContain("anexos");
  });
});
