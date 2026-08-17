import { describe, expect, it } from "vitest";
import {
  agruparPorObra,
  itemAtrasado,
  resumirMeusCartoes,
  resumirObra,
  statusItem,
  type ItemCronoDashboard,
} from "@/lib/obras/dashboardObras";
import type { EvmItemCrono } from "@/lib/pmbok/evm";

const HOJE = new Date("2026-07-17T12:00:00Z");

function item(partial: Partial<EvmItemCrono>): EvmItemCrono {
  return {
    custo: null,
    custo_baseline: null,
    percentual_previsto: null,
    percentual_realizado: null,
    data_inicio: "2026-01-01",
    data_fim: "2026-12-31",
    data_inicio_baseline: null,
    data_fim_baseline: null,
    ativo: true,
    ...partial,
  };
}

describe("dashboardObras · statusItem", () => {
  it("classifica pela régua do DashboardLean", () => {
    expect(statusItem(100)).toBe("concluido");
    expect(statusItem(150)).toBe("concluido");
    expect(statusItem(1)).toBe("em_andamento");
    expect(statusItem(0)).toBe("nao_iniciado");
    expect(statusItem(null)).toBe("nao_iniciado");
  });
});

describe("dashboardObras · itemAtrasado", () => {
  it("atrasado quando fim (baseline preferido) passou e execução < 100", () => {
    expect(itemAtrasado(item({ data_fim: "2026-07-01", percentual_realizado: 50 }), HOJE)).toBe(
      true,
    );
    expect(itemAtrasado(item({ data_fim: "2026-07-01", percentual_realizado: 100 }), HOJE)).toBe(
      false,
    );
    expect(itemAtrasado(item({ data_fim: "2026-08-01", percentual_realizado: 0 }), HOJE)).toBe(
      false,
    );
    // baseline vence sobre a data replanejada
    expect(
      itemAtrasado(
        item({ data_fim: "2026-08-01", data_fim_baseline: "2026-07-01", percentual_realizado: 10 }),
        HOJE,
      ),
    ).toBe(true);
  });
});

describe("dashboardObras · agruparPorObra", () => {
  it("agrupa por obra_id normalizado para string e descarta inativos", () => {
    const itens: ItemCronoDashboard[] = [
      { ...item({}), obra_id: 1 },
      { ...item({}), obra_id: "1" },
      { ...item({ ativo: false }), obra_id: 1 },
      { ...item({}), obra_id: 2 },
    ];
    const map = agruparPorObra(itens);
    expect(map.get("1")).toHaveLength(2);
    expect(map.get("2")).toHaveLength(1);
  });
});

describe("dashboardObras · resumirObra", () => {
  it("pondera o % físico por custo (EV/BAC) e calcula SPI", () => {
    const itens = [
      item({ custo: 900, percentual_realizado: 100, data_inicio: "2026-01-01", data_fim: "2026-06-30" }),
      item({ custo: 100, percentual_realizado: 0, data_inicio: "2026-01-01", data_fim: "2026-06-30" }),
    ];
    const r = resumirObra(itens, HOJE);
    expect(r.percFisico).toBeCloseTo(90, 5);
    expect(r.porStatus).toEqual({ concluido: 1, em_andamento: 0, nao_iniciado: 1 });
    expect(r.atrasados).toBe(1); // o item de 0% venceu em 30/06
    // Período todo já passou: PV = BAC → SPI = EV/BAC = 0.9
    expect(r.spi).toBeCloseTo(0.9, 5);
    expect(r.faixaSpi).toBe("alerta");
  });

  it("sem custos (BAC=0): cai para média simples e SPI nulo", () => {
    const itens = [
      item({ percentual_realizado: 100, percentual_previsto: 100 }),
      item({ percentual_realizado: 0, percentual_previsto: 50 }),
    ];
    const r = resumirObra(itens, HOJE);
    expect(r.percFisico).toBeCloseTo(50, 5);
    expect(r.percPrevisto).toBeCloseTo(75, 5);
    expect(r.spi).toBeNull();
    expect(r.faixaSpi).toBeNull();
  });
});

describe("dashboardObras · resumirMeusCartoes", () => {
  it("separa concluídos e classifica abertos por bucket de prazo", () => {
    const r = resumirMeusCartoes(
      [
        { id: "a", status: "concluido", prazo: "2026-07-01" },
        { id: "b", status: "aberto", prazo: "2026-07-01" }, // vencido
        { id: "c", status: "aberto", prazo: "2026-07-17" }, // hoje
        { id: "d", status: "fazendo", prazo: "2026-07-20" }, // semana
        { id: "e", status: "aberto", prazo: "2026-09-01" }, // fora dos buckets
        { id: "f", status: "aberto", prazo: null }, // sem prazo
      ],
      HOJE,
    );
    expect(r).toEqual({
      total: 6,
      abertos: 5,
      vencidos: 1,
      venceHoje: 1,
      vence7dias: 1,
      concluidos: 1,
    });
  });
});
