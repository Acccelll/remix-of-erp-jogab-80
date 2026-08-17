import { describe, it, expect } from "vitest";
import { statusPreventiva } from "../preventiva";

describe("statusPreventiva (PRO-024.slice-01)", () => {
  const hoje = "2026-07-14";

  it("retorna desconhecido quando não há última manutenção", () => {
    expect(statusPreventiva(null, { hojeIso: hoje }).status).toBe("desconhecido");
  });

  it("retorna desconhecido quando nenhuma meta bate com o estado atual", () => {
    const r = statusPreventiva(
      { proxima_preventiva_horimetro: 500 },
      { hojeIso: hoje }, // sem horimetroAtual
    );
    expect(r.status).toBe("desconhecido");
  });

  it("sinaliza ok quando todas dimensões estão fora da margem", () => {
    const r = statusPreventiva(
      { proxima_preventiva_horimetro: 500, proxima_preventiva_data: "2026-09-01" },
      { hojeIso: hoje, horimetroAtual: 300 },
    );
    expect(r.status).toBe("ok");
    expect(r.faltamHoras).toBe(200);
  });

  it("sinaliza proxima quando horímetro entra na margem", () => {
    const r = statusPreventiva(
      { proxima_preventiva_horimetro: 500 },
      { hojeIso: hoje, horimetroAtual: 470 },
      { margemHorimetro: 50 },
    );
    expect(r.status).toBe("proxima");
    expect(r.motivos[0]).toMatch(/30h/);
  });

  it("sinaliza vencida quando qualquer dimensão passou do limite", () => {
    const r = statusPreventiva(
      {
        proxima_preventiva_horimetro: 500,
        proxima_preventiva_data: "2026-07-01",
      },
      { hojeIso: hoje, horimetroAtual: 480 },
    );
    expect(r.status).toBe("vencida");
    expect(r.motivos.some((m) => m.includes("Data"))).toBe(true);
  });

  it("avalia odômetro em km com margem própria", () => {
    const r = statusPreventiva(
      { proxima_preventiva_odometro: 10000 },
      { hojeIso: hoje, odometroAtual: 9700 },
      { margemOdometro: 500 },
    );
    expect(r.status).toBe("proxima");
    expect(r.faltamKm).toBe(300);
  });
});
