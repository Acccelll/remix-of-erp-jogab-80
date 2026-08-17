import { describe, expect, it } from "vitest";
import type { FinLinha } from "../agregacoes";
import { agregarPorObra } from "../confronto";

function linha(patch: Partial<FinLinha>): FinLinha {
  return {
    lancamento_id: patch.lancamento_id ?? crypto.randomUUID(),
    obra_id: patch.obra_id ?? null,
    obra_nome: patch.obra_nome ?? null,
    obra_codigo: patch.obra_codigo ?? null,
    natureza_tipo: patch.natureza_tipo ?? 2,
    status_cod: patch.status_cod ?? 56,
    status_label: patch.status_label ?? null,
    grupo: patch.grupo ?? "2",
    subgrupo: patch.subgrupo ?? null,
    cod_natureza: patch.cod_natureza ?? null,
    desc_natureza: patch.desc_natureza ?? null,
    valor_liquido: patch.valor_liquido ?? 0,
    valor_baixado: patch.valor_baixado ?? null,
    valor_rateio: patch.valor_rateio ?? null,
    mes_competencia: patch.mes_competencia ?? null,
    data_vencimento: patch.data_vencimento ?? null,
    data_pagamento: patch.data_pagamento ?? null,
    data_emissao: patch.data_emissao ?? null,
    contraparte: patch.contraparte ?? null,
    ref_lancamento: patch.ref_lancamento ?? null,
    centro_custo: patch.centro_custo ?? null,
    desc_centro_custo: patch.desc_centro_custo ?? null,
    centro_custo_tipo: patch.centro_custo_tipo ?? "obra",
    categoria_indireta: patch.categoria_indireta ?? null,
  };
}

describe("agregarPorObra", () => {
  it("mantém despesas indiretas fora do agregado por padrão", () => {
    const out = agregarPorObra([
      linha({
        lancamento_id: "obra-a",
        obra_id: "a",
        valor_liquido: 100,
        obra_codigo: "001",
      } as Partial<FinLinha>),
      linha({ lancamento_id: "adm", grupo: "3", centro_custo_tipo: "indireto", valor_liquido: 60 }),
    ]);

    expect(out).toHaveLength(1);
    expect(out[0].despesa).toBe(100);
    expect(out[0].saldo).toBe(-100);
  });

  it("rateia administrativo proporcionalmente à despesa direta quando solicitado", () => {
    const out = agregarPorObra(
      [
        linha({
          lancamento_id: "obra-a",
          obra_id: "a",
          valor_liquido: 100,
          obra_codigo: "001",
        } as Partial<FinLinha>),
        linha({
          lancamento_id: "obra-b",
          obra_id: "b",
          valor_liquido: 300,
          obra_codigo: "002",
        } as Partial<FinLinha>),
        linha({
          lancamento_id: "adm",
          grupo: "3",
          centro_custo_tipo: "indireto",
          valor_liquido: 80,
        }),
      ],
      { ratearAdministrativo: true },
    );

    expect(out.map((r) => r.despesa)).toEqual([120, 360]);
    expect(out.map((r) => r.saldo)).toEqual([-120, -360]);
  });

  it("não rateia lançamentos cancelados", () => {
    const out = agregarPorObra(
      [
        linha({
          lancamento_id: "obra-a",
          obra_id: "a",
          valor_liquido: 100,
          obra_codigo: "001",
        } as Partial<FinLinha>),
        linha({
          lancamento_id: "adm-cancelado",
          grupo: "3",
          centro_custo_tipo: "indireto",
          valor_liquido: 80,
          status_cod: 18,
        }),
      ],
      { ratearAdministrativo: true },
    );

    expect(out[0].despesa).toBe(100);
  });
});
