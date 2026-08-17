import { describe, it, expect } from "vitest";
import { calcularPreviaFechamento, type BmsRow, type CronoItem } from "@/lib/bms/fechamento";

function mkBms(numero: number, status: string, valor: number, ini: string, fim: string): BmsRow {
  return {
    id: `b${numero}`,
    numero,
    data_inicio_janela: ini,
    data_corte: fim,
    valor_previsto_inicial: valor,
    valor_previsto_dinamico: valor,
    status,
  };
}

const crono: CronoItem[] = [
  // Item totalmente dentro da janela da BMS 1 — evita realocação específica.
  {
    id: "i1",
    descricao: "Item 1",
    data_inicio: "2025-01-01",
    data_fim: "2025-01-31",
    custo: 60000,
    ativo: true,
  },
];

describe("calcularPreviaFechamento", () => {
  it("Bug 1: futurasAntes e futurasDepois são snapshots independentes", () => {
    const todas = [
      mkBms(1, "aberta", 30000, "2025-01-01", "2025-01-31"),
      mkBms(2, "prevista", 35000, "2025-02-01", "2025-02-28"),
      mkBms(3, "prevista", 35000, "2025-03-01", "2025-03-31"),
    ];
    const r = calcularPreviaFechamento({
      bms: todas[0],
      todasBms: todas,
      valorRealizado: 20000, // delta +10000 (atraso)
      crono,
      itensMedicao: [{ cronograma_item_id: "i1", valor_atual: 20000 }],
      valorContrato: 100000,
      valorAntecipacao: 0,
    });
    expect(r.futurasAntes).not.toBe(r.futurasDepois);
    // Os snapshots "antes" devem refletir o estado original
    expect(r.futurasAntes.every((f) => f.valor_anterior === f.valor_novo)).toBe(true);
    // Os snapshots "depois" devem ter valor_novo diferente
    expect(r.futurasDepois.some((f) => f.valor_novo !== f.valor_anterior)).toBe(true);
  });

  it("Bug 2: redistribui igualmente quando todas as futuras estão zeradas", () => {
    const todas = [
      mkBms(1, "aberta", 60000, "2025-01-01", "2025-01-31"),
      mkBms(2, "prevista", 0, "2025-02-01", "2025-02-28"),
      mkBms(3, "prevista", 0, "2025-03-01", "2025-03-31"),
    ];
    const r = calcularPreviaFechamento({
      bms: todas[0],
      todasBms: todas,
      valorRealizado: 30000, // delta +30000
      crono,
      itensMedicao: [{ cronograma_item_id: "i1", valor_atual: 30000 }],
      valorContrato: 100000,
      valorAntecipacao: 0,
    });
    // Divisão igual: cada futura recebe ~saldo/2
    const valoresNovos = r.futurasDepois.map((f) => f.valor_novo);
    expect(valoresNovos[0]).toBeCloseTo(valoresNovos[1], 1);
    expect(valoresNovos[0]).toBeGreaterThan(0);
    expect(r.avisos.length).toBeGreaterThan(0);
    expect(r.saldoNaoRedistribuido).toBe(0);
  });

  it("Bug 2: sem BMS futuras → registra saldo não redistribuído e aviso", () => {
    const todas = [mkBms(1, "aberta", 60000, "2025-01-01", "2025-01-31")];
    const r = calcularPreviaFechamento({
      bms: todas[0],
      todasBms: todas,
      valorRealizado: 30000,
      crono,
      itensMedicao: [{ cronograma_item_id: "i1", valor_atual: 30000 }],
      valorContrato: 100000,
      valorAntecipacao: 0,
    });
    expect(r.saldoNaoRedistribuido).not.toBe(0);
    expect(r.avisos.length).toBeGreaterThan(0);
    expect(r.registros.some((rg) => rg.motivo === "sem_destino")).toBe(true);
  });

  it("Item 12: somaFinalContrato bate com valorContrato quando há BMS futuras", () => {
    // Cenário consistente: 3 BMS de 1 mês cada, item de 3 meses, contrato 90k.
    const cronoConsistente: CronoItem[] = [
      {
        id: "i1",
        descricao: "Item 1",
        data_inicio: "2025-01-01",
        data_fim: "2025-03-31",
        custo: 90000,
        ativo: true,
      },
    ];
    const todas = [
      mkBms(1, "aberta", 31000, "2025-01-01", "2025-01-31"),
      mkBms(2, "prevista", 28000, "2025-02-01", "2025-02-28"),
      mkBms(3, "prevista", 31000, "2025-03-01", "2025-03-31"),
    ];
    const r = calcularPreviaFechamento({
      bms: todas[0],
      todasBms: todas,
      valorRealizado: 20000, // atraso de ~10k
      crono: cronoConsistente,
      itensMedicao: [{ cronograma_item_id: "i1", valor_atual: 20000 }],
      valorContrato: 90000,
      valorAntecipacao: 0,
    });
    expect(r.divergenciaContrato).toBeLessThan(0.05);
    expect(r.somaFinalContrato).toBeCloseTo(90000, 1);
  });

  it("Item 12: divergenciaContrato > 0.05 quando saldo fica sem destino", () => {
    const todas = [mkBms(1, "aberta", 60000, "2025-01-01", "2025-01-31")];
    const r = calcularPreviaFechamento({
      bms: todas[0],
      todasBms: todas,
      valorRealizado: 30000,
      crono,
      itensMedicao: [{ cronograma_item_id: "i1", valor_atual: 30000 }],
      valorContrato: 100000,
      valorAntecipacao: 0,
    });
    expect(r.divergenciaContrato).toBeGreaterThan(0.05);
  });
});
