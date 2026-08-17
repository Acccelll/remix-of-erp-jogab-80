import { describe, it, expect } from "vitest";
import { severidadeToken, SEVERIDADE_LABEL, SEVERIDADE_ORDEM } from "../severidade";

describe("severidadeToken", () => {
  it("usa tokens semânticos (sem cores raw)", () => {
    for (const sev of ["baixa", "media", "alta", "critica", "atraso"] as const) {
      const t = severidadeToken(sev);
      expect(t.className).toContain(`bg-sev-${sev}`);
      expect(t.className).toContain(`text-sev-${sev}`);
      expect(t.className).toContain(`border-sev-${sev}`);
      expect(t.className).not.toMatch(
        /(bg|text|border)-(red|amber|orange|emerald|blue|yellow|green)-/,
      );
    }
  });
  it("tem rótulo textual para todas as severidades (não comunicar só por cor)", () => {
    expect(SEVERIDADE_LABEL.baixa).toBeTruthy();
    expect(SEVERIDADE_LABEL.critica).toBeTruthy();
    expect(SEVERIDADE_LABEL.atraso).toBeTruthy();
  });
  it("ordena por gravidade crescente", () => {
    expect(SEVERIDADE_ORDEM.baixa).toBeLessThan(SEVERIDADE_ORDEM.media);
    expect(SEVERIDADE_ORDEM.media).toBeLessThan(SEVERIDADE_ORDEM.alta);
    expect(SEVERIDADE_ORDEM.alta).toBeLessThan(SEVERIDADE_ORDEM.critica);
  });
});
