import { describe, it, expect } from "vitest";
import { saldoOrcado } from "../saldo-orcado";

describe("saldoOrcado", () => {
  it("retorna zero quando não há orçamento nem requisições", () => {
    const r = saldoOrcado(null, []);
    expect(r).toEqual({ orcado: 0, requisitado: 0, saldo: 0, excedido: false, excesso: 0 });
  });

  it("calcula saldo positivo quando requisitado < orçado", () => {
    const r = saldoOrcado({ quantidade: 100 }, [
      { quantidade: 30 },
      { quantidade: 20, status: "cotando" },
    ]);
    expect(r.orcado).toBe(100);
    expect(r.requisitado).toBe(50);
    expect(r.saldo).toBe(50);
    expect(r.excedido).toBe(false);
    expect(r.excesso).toBe(0);
  });

  it("flagga excedido quando requisitado > orçado", () => {
    const r = saldoOrcado({ quantidade: 100 }, [
      { quantidade: 80 },
      { quantidade: 50, status: "atendida" },
    ]);
    expect(r.requisitado).toBe(130);
    expect(r.saldo).toBe(-30);
    expect(r.excedido).toBe(true);
    expect(r.excesso).toBe(30);
  });

  it("ignora requisições canceladas", () => {
    const r = saldoOrcado({ quantidade: 100 }, [
      { quantidade: 40 },
      { quantidade: 90, status: "cancelada" },
    ]);
    expect(r.requisitado).toBe(40);
    expect(r.saldo).toBe(60);
    expect(r.excedido).toBe(false);
  });

  it("trata valores ausentes/NaN como zero", () => {
    const r = saldoOrcado({ quantidade: Number.NaN as unknown as number }, [
      { quantidade: undefined as unknown as number },
      { quantidade: 10 },
    ]);
    expect(r.orcado).toBe(0);
    expect(r.requisitado).toBe(10);
    expect(r.excedido).toBe(true);
    expect(r.excesso).toBe(10);
  });

  it("considera status desconhecido como vivo (conservador)", () => {
    // Default: status ausente conta como 'aberta'; status custom não previsto
    // não bloqueia o cálculo — só os explicitamente terminais (ex.: cancelada)
    // são descartados.
    const r = saldoOrcado({ quantidade: 50 }, [{ quantidade: 60, status: "aberta" }]);
    expect(r.excedido).toBe(true);
    expect(r.excesso).toBe(10);
  });
});
