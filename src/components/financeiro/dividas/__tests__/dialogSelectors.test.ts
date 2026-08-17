import { describe, expect, it } from "vitest";
import { filtrarAging, filtrarKpi } from "../dialogSelectors";

const HOJE = "2026-07-15";

/**
 * Título de baixa parcial (status TOTVS 15) já vencido. O TOTVS não muda o
 * código depois do vencimento e costuma devolver `dias_atraso` zerado — por
 * isso o hook deriva `bucket` e `dias_atraso_efetivo`, e os seletores precisam
 * respeitar os dois. Antes disso o título sumia do KPI, do aging e da lista.
 */
const parcialVencida = {
  id: "parcial-vencida",
  status_cod: 15,
  bucket: "vencido",
  dias_atraso: 0,
  dias_atraso_efetivo: 44,
  data_vencimento: "2026-06-01",
  aberto: 400,
};

const vencidaTotvs = {
  id: "vencida-totvs",
  status_cod: 40,
  bucket: "vencido",
  dias_atraso: 10,
  dias_atraso_efetivo: 10,
  data_vencimento: "2026-07-05",
  aberto: 100,
};

const venceHoje = {
  id: "vence-hoje",
  status_cod: 29,
  bucket: "hoje",
  dias_atraso: 0,
  dias_atraso_efetivo: 0,
  data_vencimento: HOJE,
  aberto: 50,
};

const aVencer = {
  id: "a-vencer",
  status_cod: 56,
  bucket: "avencer",
  dias_atraso: 0,
  dias_atraso_efetivo: 0,
  data_vencimento: "2026-07-25",
  aberto: 70,
};

const paga = {
  id: "paga",
  status_cod: 3,
  bucket: "pago",
  dias_atraso: 0,
  dias_atraso_efetivo: 0,
  data_vencimento: "2026-06-10",
  aberto: 0,
};

const base = [parcialVencida, vencidaTotvs, venceHoje, aVencer, paga];

describe("filtrarKpi", () => {
  it("inclui baixa parcial vencida no KPI de vencidos", () => {
    const ids = filtrarKpi(base, HOJE, "vencido").map((l) => l.id);
    expect(ids).toEqual(["parcial-vencida", "vencida-totvs"]);
  });

  it("não deixa a baixa parcial vencida vazar para 'a vencer'", () => {
    const ids = filtrarKpi(base, HOJE, "avencer").map((l) => l.id);
    expect(ids).toEqual(["vence-hoje", "a-vencer"]);
  });

  it("'hoje' usa o bucket em vez de comparar a data", () => {
    const ids = filtrarKpi(base, HOJE, "hoje").map((l) => l.id);
    expect(ids).toEqual(["vence-hoje"]);
  });

  it("'total' soma vencidos e futuros, e exclui os pagos", () => {
    const ids = filtrarKpi(base, HOJE, "total").map((l) => l.id);
    expect(ids).toEqual(["parcial-vencida", "vencida-totvs", "vence-hoje", "a-vencer"]);
  });

  it("sem bucket, cai no comportamento antigo por status_cod", () => {
    const semBucket = [
      { id: "s15", status_cod: 15, data_vencimento: "2026-06-01" },
      { id: "s40", status_cod: 40, data_vencimento: "2026-06-01" },
    ];
    expect(filtrarKpi(semBucket, HOJE, "vencido").map((l) => l.id)).toEqual(["s40"]);
  });
});

describe("filtrarAging", () => {
  it("usa dias_atraso_efetivo para posicionar a baixa parcial na faixa certa", () => {
    const sel = { tipo: "vencido" as const, faixa: "31-60" };
    expect(filtrarAging(base, HOJE, sel).map((l) => l.id)).toEqual(["parcial-vencida"]);
  });

  it("o dias_atraso zerado do TOTVS não joga a parcial na faixa 1-30", () => {
    const sel = { tipo: "vencido" as const, faixa: "1-30" };
    expect(filtrarAging(base, HOJE, sel).map((l) => l.id)).toEqual(["vencida-totvs"]);
  });

  it("aging de a vencer respeita o bucket", () => {
    const sel = { tipo: "avencer" as const, faixa: "8-15" };
    expect(filtrarAging(base, HOJE, sel).map((l) => l.id)).toEqual(["a-vencer"]);
  });

  it("devolve [] quando não há seleção", () => {
    expect(filtrarAging(base, HOJE, null)).toEqual([]);
  });
});
