import { describe, it, expect } from "vitest";
import {
  clonarItensParaCenario,
  aplicarDeltaDias,
  ajustarSnapshot,
  compararCenario,
  resumoCenario,
} from "../cenarios";

const itens = [
  { id: "a", data_inicio: "2026-01-01", data_fim: "2026-01-10", descricao: "A", critico: true },
  { id: "b", data_inicio: "2026-01-11", data_fim: "2026-01-20", descricao: "B", critico: false },
];

describe("cenarios what-if", () => {
  it("clona itens copiando datas para sim", () => {
    const snaps = clonarItensParaCenario(itens);
    expect(snaps).toHaveLength(2);
    expect(snaps[0].data_inicio_sim).toBe("2026-01-01");
    expect(snaps[0].data_fim_sim).toBe("2026-01-10");
  });

  it("aplica delta preservando duração", () => {
    const [s] = clonarItensParaCenario(itens);
    const moved = aplicarDeltaDias(s, 5);
    expect(moved.data_inicio_sim).toBe("2026-01-06");
    expect(moved.data_fim_sim).toBe("2026-01-15");
  });

  it("delta zero é no-op", () => {
    const [s] = clonarItensParaCenario(itens);
    expect(aplicarDeltaDias(s, 0)).toBe(s);
  });

  it("ajustarSnapshot evita duração negativa", () => {
    const [s] = clonarItensParaCenario(itens);
    const r = ajustarSnapshot(s, { data_fim_sim: "2025-12-20" });
    expect(r.data_fim_sim).toBe(r.data_inicio_sim);
  });

  it("compararCenario calcula deltas corretos", () => {
    const snaps = clonarItensParaCenario(itens);
    snaps[1] = aplicarDeltaDias(snaps[1], 7);
    const diff = compararCenario(itens, snaps);
    expect(diff[0].alterado).toBe(false);
    expect(diff[1].alterado).toBe(true);
    expect(diff[1].delta_inicio_dias).toBe(7);
    expect(diff[1].delta_fim_dias).toBe(7);
    expect(diff[1].delta_duracao_dias).toBe(0);
  });

  it("resumoCenario agrega término e críticos impactados", () => {
    const snaps = clonarItensParaCenario(itens);
    snaps[0] = aplicarDeltaDias(snaps[0], 3); // a é crítico
    const diff = compararCenario(itens, snaps);
    const r = resumoCenario(diff);
    expect(r.total_itens).toBe(2);
    expect(r.alterados).toBe(1);
    expect(r.criticos_impactados).toBe(1);
    expect(r.termino_origem).toBe("2026-01-20");
    expect(r.termino_sim).toBe("2026-01-20"); // b não mudou
  });

  it("resumoCenario detecta atraso do término geral", () => {
    const snaps = clonarItensParaCenario(itens);
    snaps[1] = aplicarDeltaDias(snaps[1], 10);
    const diff = compararCenario(itens, snaps);
    const r = resumoCenario(diff);
    expect(r.termino_sim).toBe("2026-01-30");
    expect(r.delta_termino_dias).toBe(10);
  });
});
