import { describe, it, expect } from "vitest";
import { calcularAlertasPrazo, contarPorSeveridade, hojeUtcMs } from "../alertas-prazo";

const HOJE = new Date("2026-06-24T12:00:00Z");

function mk(
  card_id: string,
  patch: Partial<Parameters<typeof calcularAlertasPrazo>[0][number]> = {},
) {
  return {
    card_id,
    numero: 1,
    titulo: "x",
    obra_id: null,
    tipo_recurso: "material_pronto",
    status_card: "identificado",
    prazo_notif_compras: null,
    prazo_notif_producao: null,
    ...patch,
  };
}

describe("calcularAlertasPrazo", () => {
  it("classifica vencido / urgente / proximo / ok", () => {
    const r = calcularAlertasPrazo(
      [
        mk("a", { prazo_notif_compras: "2026-06-20" }), // -4
        mk("b", { prazo_notif_compras: "2026-06-25" }), // 1
        mk("c", { prazo_notif_compras: "2026-06-30" }), // 6
        mk("d", { prazo_notif_compras: "2026-07-15" }), // 21
      ],
      HOJE,
    );
    const sev = Object.fromEntries(r.map((a) => [a.card_id, a.severidade]));
    expect(sev.a).toBe("vencido");
    expect(sev.b).toBe("urgente");
    expect(sev.c).toBe("proximo");
    expect(sev.d).toBe("ok");
  });

  it("ignora cards concluídos", () => {
    const r = calcularAlertasPrazo(
      [mk("a", { status_card: "concluido", prazo_notif_compras: "2026-06-20" })],
      HOJE,
    );
    expect(r).toEqual([]);
  });

  it("manufaturado usa o trilho mais severo dos dois", () => {
    const r = calcularAlertasPrazo(
      [
        mk("a", {
          tipo_recurso: "manufaturado",
          prazo_notif_compras: "2026-07-15", // ok
          prazo_notif_producao: "2026-06-22", // vencido
        }),
      ],
      HOJE,
    );
    expect(r).toHaveLength(1);
    expect(r[0].trilho).toBe("Producao");
    expect(r[0].severidade).toBe("vencido");
  });

  it("não simples ignora prazo de produção", () => {
    const r = calcularAlertasPrazo(
      [
        mk("a", {
          tipo_recurso: "servico",
          prazo_notif_compras: "2026-06-30",
          prazo_notif_producao: "2026-06-22",
        }),
      ],
      HOJE,
    );
    expect(r[0].trilho).toBe("Compras");
    expect(r[0].severidade).toBe("proximo");
  });

  it("ordena por severidade e dias", () => {
    const r = calcularAlertasPrazo(
      [
        mk("a", { prazo_notif_compras: "2026-06-30" }),
        mk("b", { prazo_notif_compras: "2026-06-20" }),
        mk("c", { prazo_notif_compras: "2026-06-25" }),
      ],
      HOJE,
    );
    expect(r.map((x) => x.card_id)).toEqual(["b", "c", "a"]);
  });

  it("contarPorSeveridade soma corretamente", () => {
    const r = calcularAlertasPrazo(
      [
        mk("a", { prazo_notif_compras: "2026-06-20" }),
        mk("b", { prazo_notif_compras: "2026-06-25" }),
        mk("c", { prazo_notif_compras: "2026-07-15" }),
      ],
      HOJE,
    );
    expect(contarPorSeveridade(r)).toEqual({
      vencido: 1,
      urgente: 1,
      proximo: 0,
      ok: 1,
    });
  });

  it("hojeUtcMs é meia-noite UTC", () => {
    const ms = hojeUtcMs(HOJE);
    expect(new Date(ms).toISOString()).toBe("2026-06-24T00:00:00.000Z");
  });
});
