/** @module-kind pure */
// Fechamento de BMS: redistribui o saldo (atraso/adiantamento) entre as BMS futuras
// e registra a rastreabilidade item a item em bms_redistribuicao.
import { parseISO } from "date-fns";
import { diasSobreposicao } from "@/lib/bms/previstas";
import { valorTotalItem as calcValorTotalItem } from "@/lib/bms/valor-item";
import { logger } from "@/lib/core/logger";

export type BmsRow = {
  id: string;
  numero: number;
  data_inicio_janela: string;
  data_corte: string;
  valor_previsto_inicial: number | string;
  valor_previsto_dinamico: number | string;
  status: string;
};

export type CronoItem = {
  id: string;
  descricao: string | null;
  data_inicio: string;
  data_fim: string;
  custo?: number | string | null;
  custo_baseline?: number | string | null;
  percentual_previsto?: number | string | null;
  ativo?: boolean | null;
};

export type ItemMedicaoRow = {
  cronograma_item_id: string;
  valor_atual: number | string;
  percentual_atual?: number | string | null;
};

export type ContribuicaoItemValor = {
  itemId: string;
  descricao: string;
  dataInicio: Date;
  dataFim: Date;
  valorTotal: number; // valor total do item ao longo de toda a vida no contrato
};

export type FuturaNova = {
  id: string;
  numero: number;
  valor_anterior: number;
  valor_novo: number;
};

export type RegistroAtraso = {
  cronograma_item_id: string | null;
  descricao_item: string;
  valor_atrasado: number;
  bms_destino_numero: number;
  valor_absorvido: number;
  motivo: "proporcional" | "realocado_por_revisao" | "sem_destino";
};

export type PreviaFechamento = {
  valorPrevistoAntes: number;
  valorRealizado: number;
  delta: number; // > 0 = atraso (sobrou saldo), < 0 = adiantou
  /** Snapshot imutável dos valores ANTES do fechamento. Não compartilha referências com `futurasDepois`. */
  futurasAntes: FuturaNova[];
  /** Valores após a redistribuição. Sempre uma cópia separada de `futurasAntes`. */
  futurasDepois: FuturaNova[];
  registros: RegistroAtraso[];
  somaFinalContrato: number;
  /** Divergência (em R$) entre soma final e valor contratual esperado, quando não foi possível redistribuir. */
  saldoNaoRedistribuido: number;
  /** Mensagens informativas para a UI (ex.: "sem BMS futuras para absorver o saldo"). */
  avisos: string[];
  /** |somaFinalContrato − (valorContrato + valorAntecipacao)|. Em condições normais ≈ 0. */
  divergenciaContrato: number;
};

function n(v: any): number {
  return Number(v ?? 0);
}

/**
 * Valor total do item ao longo do contrato (usado para prorratear por janela).
 * Mantida para compatibilidade — internamente delega para `bms-valor-item`.
 */
export function valorTotalItem(
  i: CronoItem,
  valorContrato: number,
  valorAntecipacao: number,
): number {
  return calcValorTotalItem({
    custo: n(i.custo_baseline ?? i.custo),
    percentualPrevisto: n(i.percentual_previsto),
    valorContrato,
    valorAntecipacao,
  });
}

/** Valor previsto de UM item em UMA janela (proporcional aos dias de sobreposição). */
export function previstoItemNaJanela(
  it: ContribuicaoItemValor,
  janelaIni: Date,
  janelaFim: Date,
): number {
  const dur = Math.max(
    1,
    Math.round((it.dataFim.getTime() - it.dataInicio.getTime()) / 86400000) + 1,
  );
  const dias = diasSobreposicao(it.dataInicio, it.dataFim, janelaIni, janelaFim);
  return dias > 0 ? (dias / dur) * it.valorTotal : 0;
}

/**
 * Calcula a prévia (sem persistir) do fechamento da BMS.
 * - delta total = previsto_dinamico_atual - realizado
 * - delta por item = previsto_no_periodo - realizado_no_periodo (somente shortfalls e excedentes)
 * - regra de exceção: se item.data_fim > data_corte e cai dentro de uma BMS futura,
 *   o saldo desse item vai 100% para aquela BMS (motivo "realocado_por_revisao").
 *   Caso contrário, o item entra na bolsa de redistribuição proporcional.
 */
export function calcularPreviaFechamento(opts: {
  bms: BmsRow;
  todasBms: BmsRow[];
  valorRealizado: number;
  crono: CronoItem[];
  itensMedicao: ItemMedicaoRow[]; // já filtrados pela medição vinculada
  valorContrato: number;
  valorAntecipacao: number;
}): PreviaFechamento {
  const { bms, todasBms, valorRealizado, crono, itensMedicao, valorContrato, valorAntecipacao } =
    opts;

  const valorPrevistoAntes = n(bms.valor_previsto_dinamico);
  const delta = valorPrevistoAntes - valorRealizado;

  const janelaIni = parseISO(bms.data_inicio_janela);
  const janelaFim = parseISO(bms.data_corte);

  const futuras = todasBms
    .filter((b) => b.status === "prevista" && Number(b.numero) > Number(bms.numero))
    .sort((a, b) => Number(a.numero) - Number(b.numero));

  // Snapshot IMUTÁVEL dos valores antes do fechamento — nunca é mutado.
  const futurasAntes: FuturaNova[] = futuras.map((f) => ({
    id: f.id,
    numero: f.numero,
    valor_anterior: n(f.valor_previsto_dinamico),
    valor_novo: n(f.valor_previsto_dinamico),
  }));
  // Cópia independente, onde TODAS as mutações abaixo acontecem.
  const futurasDepois: FuturaNova[] = futurasAntes.map((f) => ({ ...f }));

  // Construir contribuição por item ATIVO do cronograma
  const folhas = crono.filter((c) => c.ativo !== false);
  const itensValor: ContribuicaoItemValor[] = folhas.map((c) => ({
    itemId: c.id,
    descricao: c.descricao ?? "(sem descrição)",
    dataInicio: parseISO(c.data_inicio),
    dataFim: parseISO(c.data_fim),
    valorTotal: valorTotalItem(c, valorContrato, valorAntecipacao),
  }));

  // Realizado por item (vindo dos itens_medicao da medição vinculada)
  const realizadoPorItem = new Map<string, number>();
  for (const im of itensMedicao) {
    realizadoPorItem.set(
      im.cronograma_item_id,
      (realizadoPorItem.get(im.cronograma_item_id) ?? 0) + n(im.valor_atual),
    );
  }

  const registros: RegistroAtraso[] = [];
  const avisos: string[] = [];

  // Acumulador para realocação específica (por BMS destino)
  const realocacoesEspecificas = new Map<string, number>(); // futuraId → valor a somar

  // Acumulador para o pool proporcional
  let saldoPool = 0;

  for (const it of itensValor) {
    const previsto = previstoItemNaJanela(it, janelaIni, janelaFim);
    const realizado = realizadoPorItem.get(it.itemId) ?? 0;
    const atraso = previsto - realizado;
    if (Math.abs(atraso) < 0.005) continue; // ignora ruído de centavos

    // Exceção: revisão moveu data_fim para uma futura BMS?
    let alocouEspecifica = false;
    if (it.dataFim > janelaFim) {
      const destino = futuras.find((f) => {
        const fi = parseISO(f.data_inicio_janela);
        const ff = parseISO(f.data_corte);
        return it.dataFim >= fi && it.dataFim <= ff;
      });
      if (destino) {
        realocacoesEspecificas.set(
          destino.id,
          (realocacoesEspecificas.get(destino.id) ?? 0) + atraso,
        );
        registros.push({
          cronograma_item_id: it.itemId,
          descricao_item: `${it.descricao} (realocado por revisão de cronograma)`,
          valor_atrasado: atraso,
          bms_destino_numero: destino.numero,
          valor_absorvido: atraso,
          motivo: "realocado_por_revisao",
        });
        alocouEspecifica = true;
      }
    }

    if (!alocouEspecifica) {
      saldoPool += atraso;
      registros.push({
        cronograma_item_id: it.itemId,
        descricao_item: it.descricao,
        valor_atrasado: atraso,
        bms_destino_numero: -1, // placeholder; substituído abaixo
        valor_absorvido: 0,
        motivo: "proporcional",
      });
    }
  }

  // Aplica realocações específicas (em futurasDepois, preserva futurasAntes intacto)
  for (const f of futurasDepois) {
    const extra = realocacoesEspecificas.get(f.id) ?? 0;
    f.valor_novo = f.valor_anterior + extra;
  }

  // Pesos baseados no snapshot ANTES (consistente independente de realocações específicas).
  const totalPesos = futurasAntes.reduce((a, f) => a + f.valor_anterior, 0);
  let saldoNaoRedistribuido = 0;

  if (Math.abs(saldoPool) >= 0.005) {
    if (futurasDepois.length === 0) {
      // Sem futuras para absorver — registra aviso e devolve o saldo para o caller.
      saldoNaoRedistribuido = saldoPool;
      avisos.push(
        `Não há BMS futuras para absorver R$ ${saldoPool.toFixed(2)} de saldo. O total do contrato ficará divergente.`,
      );
      registros.push({
        cronograma_item_id: null,
        descricao_item: "Saldo sem destino (sem BMS futuras)",
        valor_atrasado: saldoPool,
        bms_destino_numero: -1,
        valor_absorvido: 0,
        motivo: "sem_destino",
      });
    } else if (totalPesos > 0) {
      // Caso comum: distribui proporcionalmente.
      for (const f of futurasDepois) {
        const peso = f.valor_anterior / totalPesos;
        f.valor_novo += saldoPool * peso;
      }
    } else {
      // Todas as futuras têm valor zero — fallback: divisão igualitária (consistente com billing.ts).
      const parte = saldoPool / futurasDepois.length;
      for (const f of futurasDepois) f.valor_novo = f.valor_anterior + parte;
      avisos.push("Todas as BMS futuras estavam zeradas — saldo dividido igualmente entre elas.");
    }
  }

  // Substitui placeholders dos registros proporcionais por uma linha PARA CADA BMS futura.
  // Quando totalPesos = 0 mas há futuras, usamos peso igual (1/N) para refletir o fallback acima.
  const registrosFinais: RegistroAtraso[] = [];
  const pesoFallbackIgual =
    totalPesos <= 0 && futurasDepois.length > 0 ? 1 / futurasDepois.length : 0;
  for (const r of registros) {
    if (r.motivo === "realocado_por_revisao" || r.motivo === "sem_destino") {
      registrosFinais.push(r);
      continue;
    }
    if (Math.abs(r.valor_atrasado) < 0.005 || futurasDepois.length === 0) continue;
    for (const f of futurasDepois) {
      const peso = totalPesos > 0 ? f.valor_anterior / totalPesos : pesoFallbackIgual;
      const absorvido = r.valor_atrasado * peso;
      if (Math.abs(absorvido) < 0.005) continue;
      registrosFinais.push({
        cronograma_item_id: r.cronograma_item_id,
        descricao_item: r.descricao_item,
        valor_atrasado: r.valor_atrasado,
        bms_destino_numero: f.numero,
        valor_absorvido: absorvido,
        motivo: "proporcional",
      });
    }
  }

  // Soma de verificação do contrato (todas as BMS — atual + fechadas + futuras novas)
  const somaFinalContrato = todasBms.reduce((acc, b) => {
    if (b.id === bms.id) return acc + valorRealizado;
    const fnova = futurasDepois.find((f) => f.id === b.id);
    if (fnova) return acc + fnova.valor_novo;
    return acc + n(b.valor_previsto_dinamico);
  }, 0);

  // Assertion: a soma final deve bater com o valor contratado (+ antecipação).
  const totalContratoEsperado = valorContrato + valorAntecipacao;
  const divergenciaContrato = Math.abs(somaFinalContrato - totalContratoEsperado);
  if (divergenciaContrato > 0.05) {
    const msg = `Divergência de R$ ${divergenciaContrato.toFixed(2)} entre soma final (R$ ${somaFinalContrato.toFixed(2)}) e valor contratado (R$ ${totalContratoEsperado.toFixed(2)}).`;
    avisos.push(msg);
    if (import.meta.env?.DEV) {
      // eslint-disable-next-line no-console
      logger.error("[bms-fechamento]", msg, { saldoNaoRedistribuido, registros: registrosFinais });
    }
  }

  return {
    valorPrevistoAntes,
    valorRealizado,
    delta,
    futurasAntes,
    futurasDepois,
    registros: registrosFinais,
    somaFinalContrato,
    saldoNaoRedistribuido,
    avisos,
    divergenciaContrato,
  };
}
