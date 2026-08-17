import { describe, it, expect } from "vitest";
import {
  mediaEfetivo,
  percentTrabalhavel,
  ocorrenciasPorTipo,
  cruzarRdoComCompromissos,
  type RdoRow,
  type EfetivoRow,
} from "../metrics";

const rdo = (id: string, data: string, t = [true, true, true]): RdoRow => ({
  id,
  obra_id: "o",
  data,
  trabalhavel_manha: t[0],
  trabalhavel_tarde: t[1],
  trabalhavel_noite: t[2],
});

describe("mediaEfetivo", () => {
  it("retorna 0 sem RDOs", () => {
    expect(mediaEfetivo([], [])).toBe(0);
  });
  it("soma quantidades presentes e divide por nº de RDOs", () => {
    const rdos = [rdo("a", "2026-01-01"), rdo("b", "2026-01-02")];
    const ef: EfetivoRow[] = [
      { rdo_id: "a", quantidade: 5, presente: true },
      { rdo_id: "a", quantidade: 3, presente: true },
      { rdo_id: "a", quantidade: 10, presente: false }, // ignora
      { rdo_id: "b", quantidade: 4, presente: true },
    ];
    expect(mediaEfetivo(rdos, ef)).toBe(6); // (8 + 4) / 2
  });
});

describe("percentTrabalhavel", () => {
  it("conta 3 turnos por RDO", () => {
    const rdos = [rdo("a", "x", [true, true, false]), rdo("b", "y", [true, false, false])];
    expect(percentTrabalhavel(rdos)).toBeCloseTo(3 / 6);
  });
  it("retorna 0 sem RDOs", () => {
    expect(percentTrabalhavel([])).toBe(0);
  });
});

describe("ocorrenciasPorTipo", () => {
  it("agrupa e ordena desc", () => {
    const r = ocorrenciasPorTipo([
      { rdo_id: "a", tipo: "chuva", descricao: "" },
      { rdo_id: "a", tipo: "chuva", descricao: "" },
      { rdo_id: "b", tipo: "falta_material", descricao: "" },
    ]);
    expect(r).toEqual([
      { tipo: "chuva", count: 2 },
      { tipo: "falta_material", count: 1 },
    ]);
  });
});

describe("cruzarRdoComCompromissos", () => {
  it("encontra execução dentro da semana do compromisso", () => {
    const rdos = [rdo("r1", "2026-01-07")]; // quarta
    const out = cruzarRdoComCompromissos(
      rdos,
      [{ rdo_id: "r1", cronograma_item_id: "ci1", descricao: "x", quantidade: 12 }],
      [{ id: "p1", cronograma_item_id: "ci1" }],
      [{ id: "c1", pacote_id: "p1", semana_inicio: "2026-01-05", concluido: false }],
    );
    expect(out).toEqual([{ compromissoId: "c1", executadoEm: "2026-01-07", quantidade: 12 }]);
  });
  it("ignora execução fora da semana", () => {
    const rdos = [rdo("r1", "2026-01-20")];
    const out = cruzarRdoComCompromissos(
      rdos,
      [{ rdo_id: "r1", cronograma_item_id: "ci1", descricao: "x", quantidade: 1 }],
      [{ id: "p1", cronograma_item_id: "ci1" }],
      [{ id: "c1", pacote_id: "p1", semana_inicio: "2026-01-05", concluido: false }],
    );
    expect(out).toEqual([]);
  });
});
