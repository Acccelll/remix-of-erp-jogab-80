// PRO-003.slice-08 — Smoke E2E do pipeline puro DP: validação → fechar → trava → reabrir.
import { describe, expect, it } from "vitest";
import {
  competenciaDe,
  competenciaFechada,
  competenciaValida,
  fechamentoAtivo,
  fecharCompetencia,
  podeEditarCompetencia,
  reabrirCompetencia,
  type FechamentoCompetencia,
} from "../fechamento-competencia";

describe("PRO-003 · pipeline fechamento DP (puro)", () => {
  it("valida competência, fecha, trava, reabre e volta a permitir edição", () => {
    const comp = competenciaDe("2026-07-15");
    expect(comp).toBe("2026-07");
    expect(competenciaValida(comp)).toBe(true);

    const registros: FechamentoCompetencia[] = [];
    // aberto por padrão
    expect(podeEditarCompetencia(registros, comp).ok).toBe(true);

    // fechar
    const f1 = fecharCompetencia({
      competencia: comp,
      fechadoPor: "Ana",
      motivo: "Fechamento mensal",
      fechamentos: registros,
      agora: () => new Date("2026-08-01T12:00:00Z"),
    });
    registros.push(f1);
    expect(competenciaFechada(registros, comp)).toBe(true);
    const trava = podeEditarCompetencia(registros, comp);
    expect(trava.ok).toBe(false);
    expect(trava.motivo).toMatch(/2026-07/);
    expect(fechamentoAtivo(registros, comp)?.fechadoPor).toBe("Ana");

    // não pode fechar duas vezes
    expect(() =>
      fecharCompetencia({
        competencia: comp,
        fechadoPor: "Bob",
        fechamentos: registros,
      }),
    ).toThrow(/já está fechada/);

    // reabrir exige motivo
    expect(() =>
      reabrirCompetencia({
        competencia: comp,
        reabertoPor: "Ana",
        motivoReabertura: "",
        fechamentos: registros,
      }),
    ).toThrow(/[Mm]otivo/);

    // reabertura registra e libera edição
    const reaberto = reabrirCompetencia({
      competencia: comp,
      reabertoPor: "Ana",
      motivoReabertura: "Ajuste de holerite",
      fechamentos: registros,
      agora: () => new Date("2026-08-02T09:00:00Z"),
    });
    const proximos = registros.map((f) => (f.fechadoEm === f1.fechadoEm ? reaberto : f));
    expect(competenciaFechada(proximos, comp)).toBe(false);
    expect(podeEditarCompetencia(proximos, comp).ok).toBe(true);
    expect(reaberto.motivoReabertura).toBe("Ajuste de holerite");
  });
});
