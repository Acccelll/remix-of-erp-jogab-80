import { describe, expect, it } from "vitest";
import {
  competenciaDe,
  competenciaFechada,
  competenciaValida,
  competenciasNoIntervalo,
  fecharCompetencia,
  podeCarregarPeriodo,
  podeEditarCompetencia,
  reabrirCompetencia,
  type FechamentoCompetencia,
} from "../fechamento-competencia";

const agora = (iso: string) => () => new Date(iso);

describe("competenciaValida / competenciaDe", () => {
  it("aceita YYYY-MM válido e rejeita restante", () => {
    expect(competenciaValida("2026-07")).toBe(true);
    expect(competenciaValida("2026-13")).toBe(false);
    expect(competenciaValida("26-07")).toBe(false);
  });
  it("extrai competência de data ISO em UTC", () => {
    expect(competenciaDe("2026-07-15T10:00:00Z")).toBe("2026-07");
  });
});

describe("fecharCompetencia", () => {
  it("gera registro válido", () => {
    const f = fecharCompetencia({
      competencia: "2026-07",
      fechadoPor: "Ana",
      fechamentos: [],
      agora: agora("2026-08-01T12:00:00Z"),
    });
    expect(f.fechadoEm).toBe("2026-08-01T12:00:00.000Z");
    expect(f.fechadoPor).toBe("Ana");
  });
  it("rejeita duplicidade e valida entrada", () => {
    const existente: FechamentoCompetencia = {
      competencia: "2026-07",
      fechadoEm: "2026-08-01T12:00:00.000Z",
      fechadoPor: "Ana",
    };
    expect(() =>
      fecharCompetencia({ competencia: "2026-07", fechadoPor: "Ana", fechamentos: [existente] }),
    ).toThrow(/já está fechada/);
    expect(() =>
      fecharCompetencia({ competencia: "2026-13", fechadoPor: "Ana", fechamentos: [] }),
    ).toThrow(/inválida/);
    expect(() =>
      fecharCompetencia({ competencia: "2026-07", fechadoPor: "  ", fechamentos: [] }),
    ).toThrow(/responsável/);
  });
});

describe("podeEditarCompetencia / competenciaFechada", () => {
  const fechado: FechamentoCompetencia = {
    competencia: "2026-07",
    fechadoEm: "2026-08-01T12:00:00.000Z",
    fechadoPor: "Ana",
  };
  it("bloqueia competência fechada e libera abertas", () => {
    expect(competenciaFechada([fechado], "2026-07")).toBe(true);
    expect(competenciaFechada([fechado], "2026-06")).toBe(false);
    expect(podeEditarCompetencia([fechado], "2026-07").ok).toBe(false);
    expect(podeEditarCompetencia([fechado], "2026-08").ok).toBe(true);
  });
  it("libera após reabertura", () => {
    const reaberto: FechamentoCompetencia = {
      ...fechado,
      reabertoEm: "2026-08-05T09:00:00.000Z",
      reabertoPor: "Bruno",
      motivoReabertura: "ajuste retroativo",
    };
    expect(competenciaFechada([reaberto], "2026-07")).toBe(false);
    expect(podeEditarCompetencia([reaberto], "2026-07").ok).toBe(true);
  });
});

describe("reabrirCompetencia", () => {
  const fechado: FechamentoCompetencia = {
    competencia: "2026-07",
    fechadoEm: "2026-08-01T12:00:00.000Z",
    fechadoPor: "Ana",
  };
  it("exige motivo e responsável", () => {
    expect(() =>
      reabrirCompetencia({
        competencia: "2026-07",
        reabertoPor: "Bruno",
        motivoReabertura: "",
        fechamentos: [fechado],
      }),
    ).toThrow(/Motivo/);
    expect(() =>
      reabrirCompetencia({
        competencia: "2026-07",
        reabertoPor: " ",
        motivoReabertura: "x",
        fechamentos: [fechado],
      }),
    ).toThrow(/responsável/);
  });
  it("rejeita reabrir competência aberta", () => {
    expect(() =>
      reabrirCompetencia({
        competencia: "2026-06",
        reabertoPor: "Bruno",
        motivoReabertura: "x",
        fechamentos: [fechado],
      }),
    ).toThrow(/não está fechada/);
  });
  it("gera reabertura com timestamp", () => {
    const r = reabrirCompetencia({
      competencia: "2026-07",
      reabertoPor: "Bruno",
      motivoReabertura: "erro em rubrica",
      fechamentos: [fechado],
      agora: agora("2026-08-05T09:00:00Z"),
    });
    expect(r.reabertoEm).toBe("2026-08-05T09:00:00.000Z");
    expect(r.reabertoPor).toBe("Bruno");
  });
});

describe("competenciasNoIntervalo", () => {
  it("devolve a competência única quando o período cabe num mês", () => {
    expect(competenciasNoIntervalo("2026-08-01", "2026-08-31")).toEqual(["2026-08"]);
  });

  it("cobre todas as competências que o período atravessa", () => {
    // Importação de ponto raramente respeita o mês fechado.
    expect(competenciasNoIntervalo("2026-07-26", "2026-08-05")).toEqual(["2026-07", "2026-08"]);
    expect(competenciasNoIntervalo("2026-11-20", "2027-01-10")).toEqual([
      "2026-11",
      "2026-12",
      "2027-01",
    ]);
  });

  it("rejeita período invertido ou inválido", () => {
    expect(competenciasNoIntervalo("2026-08-31", "2026-08-01")).toEqual([]);
    expect(competenciasNoIntervalo("", "2026-08-01")).toEqual([]);
  });
});

describe("podeCarregarPeriodo", () => {
  const fechadoJulho: FechamentoCompetencia = {
    competencia: "2026-07",
    fechadoEm: "2026-08-02T12:00:00.000Z",
    fechadoPor: "Ana",
  };

  it("libera período sem competência fechada", () => {
    expect(podeCarregarPeriodo([fechadoJulho], "2026-08-01", "2026-08-31").ok).toBe(true);
  });

  it("barra quando qualquer competência do intervalo está fechada", () => {
    const trava = podeCarregarPeriodo([fechadoJulho], "2026-07-28", "2026-08-05");
    expect(trava.ok).toBe(false);
    expect(trava.motivo).toContain("2026-07");
    expect(trava.motivo).toContain("Ana");
  });

  it("volta a liberar depois da reabertura", () => {
    const reaberto: FechamentoCompetencia = {
      ...fechadoJulho,
      reabertoEm: "2026-08-03T09:00:00.000Z",
      reabertoPor: "Bruno",
      motivoReabertura: "ajuste de marcação",
    };
    expect(podeCarregarPeriodo([reaberto], "2026-07-01", "2026-07-31").ok).toBe(true);
  });
});
