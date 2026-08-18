import { describe, expect, it } from "vitest";

import {
  calcularKpisTitulos,
  filtrarTitulos,
  FILTROS_TITULOS_VAZIOS,
  statusVisualTitulo,
} from "@/lib/financeiro/titulos-ui";
import type { TituloCanonicoResumo } from "@/lib/repositories/financeiro-titulos";

function titulo(patch: Partial<TituloCanonicoResumo> = {}): TituloCanonicoResumo {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    tipo: "pagar",
    empresa_id: null,
    filial: null,
    contraparte_id: null,
    cnpj_cpf: "12.345.678/0001-90",
    nome: "Fornecedor Árvore Ltda",
    nome_fantasia: "Árvore",
    tipo_documento: "MANUAL",
    numero_documento: "MAN-001",
    serie_documento: null,
    parcela_numero: null,
    parcela_total: null,
    data_emissao: "2026-08-01",
    data_competencia: "2026-08-01",
    data_vencimento: "2026-08-10",
    data_previsao_baixa: null,
    valor_original: 100,
    valor_desconto: 0,
    valor_juros: 0,
    valor_multa: 0,
    valor_acrescimos: 0,
    valor_retencoes: 0,
    valor_liquido: 100,
    centro_custo: "01.001",
    obra_id: null,
    historico: "Compra de materiais",
    observacao: null,
    origem_tipo: "manual",
    origem_ref: null,
    status: "aberto",
    criado_em: "2026-08-01T12:00:00Z",
    criado_por: null,
    atualizado_em: "2026-08-01T12:00:00Z",
    atualizado_por: null,
    cancelado_em: null,
    cancelado_por: null,
    valor_baixado: 0,
    saldo_aberto: 100,
    valor_movimentado: 0,
    qtd_baixas: 0,
    data_primeira_baixa: null,
    data_ultima_baixa: null,
    status_calculado: "aberto",
    ...patch,
  };
}

describe("statusVisualTitulo", () => {
  it("deriva Vencido sem alterar o status persistido", () => {
    const row = titulo({ data_vencimento: "2026-08-10", status: "aberto", status_calculado: "aberto" });

    expect(statusVisualTitulo(row, "2026-08-17")).toBe("vencido");
    expect(row.status).toBe("aberto");
  });

  it("mantém a urgência de vencido mesmo quando houve baixa parcial", () => {
    const row = titulo({
      data_vencimento: "2026-08-10",
      status: "parcial",
      status_calculado: "parcial",
      valor_baixado: 25,
      saldo_aberto: 75,
    });

    expect(statusVisualTitulo(row, "2026-08-17")).toBe("vencido");
  });

  it("não marca como vencido um título já baixado", () => {
    const row = titulo({
      data_vencimento: "2026-08-10",
      status: "baixado",
      status_calculado: "baixado",
      valor_baixado: 100,
      saldo_aberto: 0,
    });

    expect(statusVisualTitulo(row, "2026-08-17")).toBe("baixado");
  });
});

describe("filtrarTitulos", () => {
  it("busca sem acento e combina tipo/status", () => {
    const rows = [
      titulo(),
      titulo({
        id: "22222222-2222-4222-8222-222222222222",
        tipo: "receber",
        nome: "Cliente Horizonte",
        nome_fantasia: null,
        numero_documento: "REC-002",
        data_vencimento: "2026-09-10",
      }),
    ];

    const encontrados = filtrarTitulos(
      rows,
      {
        ...FILTROS_TITULOS_VAZIOS,
        busca: "arvore",
        tipo: "pagar",
        status: "vencido",
      },
      "2026-08-17",
    );

    expect(encontrados.map((row) => row.id)).toEqual([rows[0].id]);
  });
});

describe("calcularKpisTitulos", () => {
  it("usa saldo aberto para pagar/receber e soma vencidos", () => {
    const rows = [
      titulo({ saldo_aberto: 70, valor_baixado: 30 }),
      titulo({
        id: "22222222-2222-4222-8222-222222222222",
        tipo: "receber",
        data_vencimento: "2026-09-10",
        saldo_aberto: 200,
        valor_liquido: 200,
      }),
    ];

    expect(calcularKpisTitulos(rows, "2026-08-17")).toEqual({
      pagarAberto: 70,
      receberAberto: 200,
      vencidosValor: 70,
      vencidosQuantidade: 1,
      valorBaixado: 30,
      quantidade: 2,
    });
  });
});
