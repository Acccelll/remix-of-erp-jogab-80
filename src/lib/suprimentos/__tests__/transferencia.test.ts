import { describe, it, expect } from "vitest";
import { aplicarTransferencia, TransferenciaError } from "../transferencia";

const INSUMO = "i1";

describe("aplicarTransferencia", () => {
  it("transfere com atualização dos dois locais", () => {
    const saldos = [
      { local: "A", insumo_id: INSUMO, saldo: 10 },
      { local: "B", insumo_id: INSUMO, saldo: 2 },
    ];
    const r = aplicarTransferencia({
      saldos,
      insumo_id: INSUMO,
      origem: "A",
      destino: "B",
      quantidade: 3,
      ref: "abc",
    });
    expect(r.saldosAtualizados.find((s) => s.local === "A")!.saldo).toBe(7);
    expect(r.saldosAtualizados.find((s) => s.local === "B")!.saldo).toBe(5);
    expect(r.movimentacoes[0]).toMatchObject({ local: "A", tipo: "saida", quantidade: 3 });
    expect(r.movimentacoes[1]).toMatchObject({ local: "B", tipo: "entrada", quantidade: 3 });
    expect(r.movimentacoes[0].origem).toBe("transferencia:abc");
    expect(r.movimentacoes[1].origem).toBe("transferencia:abc");
  });

  it("cria saldo no destino quando não existir", () => {
    const r = aplicarTransferencia({
      saldos: [{ local: "A", insumo_id: INSUMO, saldo: 5 }],
      insumo_id: INSUMO,
      origem: "A",
      destino: "B",
      quantidade: 2,
      ref: "x",
    });
    expect(r.saldosAtualizados.find((s) => s.local === "B")!.saldo).toBe(2);
  });

  it("bloqueia saldo insuficiente", () => {
    expect(() =>
      aplicarTransferencia({
        saldos: [{ local: "A", insumo_id: INSUMO, saldo: 1 }],
        insumo_id: INSUMO,
        origem: "A",
        destino: "B",
        quantidade: 5,
      }),
    ).toThrowError(TransferenciaError);
  });

  it("bloqueia origem=destino", () => {
    expect(() =>
      aplicarTransferencia({
        saldos: [{ local: "A", insumo_id: INSUMO, saldo: 10 }],
        insumo_id: INSUMO,
        origem: "A",
        destino: "A",
        quantidade: 1,
      }),
    ).toThrowError(/diferentes/i);
  });

  it("bloqueia quantidade <= 0", () => {
    expect(() =>
      aplicarTransferencia({
        saldos: [{ local: "A", insumo_id: INSUMO, saldo: 10 }],
        insumo_id: INSUMO,
        origem: "A",
        destino: "B",
        quantidade: 0,
      }),
    ).toThrowError(/maior que zero/i);
  });
});
