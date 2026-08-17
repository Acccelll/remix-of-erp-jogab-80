import { describe, expect, it } from "vitest";
import { calcularPrazos, type LeadTimeTemplate } from "../lead-times";

const TPL_MATERIAL: LeadTimeTemplate = {
  tipoRecurso: "material_pronto",
  diasNecessidade: 1,
  diasPedido: 5,
  diasNotifCompras: 5,
};

const TPL_MANUFATURADO: LeadTimeTemplate = {
  tipoRecurso: "manufaturado",
  diasNecessidade: 1,
  diasPedido: 5,
  diasNotifCompras: 5,
  diasProdIniciar: 5,
  diasNotifProducao: 2,
};

describe("calcularPrazos — material_pronto", () => {
  it("exemplo do usuário: atividade em 24/06 → necessidade 23/06, pedido 18/06, notif 13/06", () => {
    const p = calcularPrazos("2026-06-24", TPL_MATERIAL);
    expect(p.dataNecessidadeObra).toBe("2026-06-23");
    expect(p.prazoPedido).toBe("2026-06-18");
    expect(p.prazoNotifCompras).toBe("2026-06-13");
    expect(p.prazoProdIniciar).toBeUndefined();
    expect(p.prazoNotifProducao).toBeUndefined();
  });

  it("vira o mês corretamente (início em 03/03 com 5 dias de pedido)", () => {
    const p = calcularPrazos("2026-03-03", TPL_MATERIAL);
    expect(p.dataNecessidadeObra).toBe("2026-03-02");
    expect(p.prazoPedido).toBe("2026-02-25");
    expect(p.prazoNotifCompras).toBe("2026-02-20");
  });

  it("vira o ano corretamente (início em 02/01)", () => {
    const p = calcularPrazos("2027-01-02", TPL_MATERIAL);
    expect(p.dataNecessidadeObra).toBe("2027-01-01");
    expect(p.prazoPedido).toBe("2026-12-27");
    expect(p.prazoNotifCompras).toBe("2026-12-22");
  });

  it("usa dias úteis quando calendário é informado", () => {
    const p = calcularPrazos("2026-06-29", TPL_MATERIAL, { usarDiasUteis: true });
    expect(p.dataNecessidadeObra).toBe("2026-06-26");
    expect(p.prazoPedido).toBe("2026-06-19");
    expect(p.prazoNotifCompras).toBe("2026-06-12");
  });
});

describe("calcularPrazos — manufaturado", () => {
  it("insere etapa de produção entre necessidade e pedido (5 prazos)", () => {
    // inicio 30/06 → nec 29/06 → prodIniciar 24/06 → pedido 19/06
    // → notifCompras 14/06 → notifProducao 22/06
    const p = calcularPrazos("2026-06-30", TPL_MANUFATURADO);
    expect(p.dataNecessidadeObra).toBe("2026-06-29");
    expect(p.prazoProdIniciar).toBe("2026-06-24");
    expect(p.prazoPedido).toBe("2026-06-19");
    expect(p.prazoNotifCompras).toBe("2026-06-14");
    expect(p.prazoNotifProducao).toBe("2026-06-22");
  });
});

describe("calcularPrazos — validações", () => {
  it("lança erro se manufaturado sem diasProdIniciar", () => {
    expect(() =>
      calcularPrazos("2026-06-30", {
        tipoRecurso: "manufaturado",
        diasNecessidade: 1,
        diasPedido: 5,
        diasNotifCompras: 5,
        diasNotifProducao: 2,
      }),
    ).toThrow(/manufaturado/i);
  });

  it("lança erro se manufaturado sem diasNotifProducao", () => {
    expect(() =>
      calcularPrazos("2026-06-30", {
        tipoRecurso: "manufaturado",
        diasNecessidade: 1,
        diasPedido: 5,
        diasNotifCompras: 5,
        diasProdIniciar: 5,
      }),
    ).toThrow(/manufaturado/i);
  });

  it("lança erro em ISO inválido", () => {
    expect(() => calcularPrazos("30/06/2026", TPL_MATERIAL)).toThrow(/yyyy-mm-dd/i);
  });
});
