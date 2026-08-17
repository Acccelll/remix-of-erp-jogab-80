import { describe, expect, it } from "vitest";
import { filtrarContratosCronograma, projetarPorContratoMes } from "../recorrencia";

describe("projetarPorContratoMes", () => {
  const hoje = new Date(2026, 0, 15); // jan/26

  it("gera lista de meses do horizonte a partir do mês corrente", () => {
    const r = projetarPorContratoMes([], 3, hoje);
    expect(r.meses).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(r.linhas).toEqual([]);
  });

  it("distribui valor apenas nos meses dentro do intervalo do contrato", () => {
    const contratos = [
      {
        id: "a",
        valor: 1000,
        inicio: "2026-02-01",
        termino: "2026-03-31",
        status: "ativo",
        ativo: true,
        obraAtualId: "obra-1",
      },
      {
        id: "b",
        valor: 500,
        inicio: "2025-01-01",
        status: "ativo",
        ativo: true,
      },
    ];
    const r = projetarPorContratoMes(contratos, 3, hoje);
    const a = r.linhas.find((l) => l.id === "a")!;
    expect(a.porMes).toEqual({ "2026-02": 1000, "2026-03": 1000 });
    expect(a.total).toBe(2000);
    const b = r.linhas.find((l) => l.id === "b")!;
    expect(b.total).toBe(1500);
  });

  it("omite contratos não elegíveis", () => {
    const r = projetarPorContratoMes(
      [{ id: "x", valor: 0, inicio: "2026-01-01", status: "ativo", ativo: true }],
      3,
      hoje,
    );
    expect(r.linhas).toEqual([]);
  });
});

describe("filtrarContratosCronograma", () => {
  const contratos = [
    { valor: 100, inicio: "2026-01-01", status: "ativo", ativo: true, obraAtualId: "obra-1" },
    { valor: 200, inicio: "2026-01-01", status: "suspenso", ativo: true, obraAtualId: "obra-1" },
    { valor: 300, inicio: "2026-01-01", status: "ativo", ativo: true, obraAtualId: null },
  ];

  it("restringe o cronograma para contratos com status ativo", () => {
    const r = filtrarContratosCronograma(contratos, { somenteStatusAtivo: true });
    expect(r.map((c) => c.valor)).toEqual([100, 300]);
  });

  it("restringe o cronograma por obra ou por contratos sem obra", () => {
    expect(filtrarContratosCronograma(contratos, { obraAtualId: "obra-1" }).map((c) => c.valor)).toEqual([100, 200]);
    expect(filtrarContratosCronograma(contratos, { obraAtualId: null }).map((c) => c.valor)).toEqual([300]);
  });
});
