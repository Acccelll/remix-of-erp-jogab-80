/** @module-kind pure */
// Agregações do Dashboard Home (rota "/"): progresso das obras a partir do
// cronograma e resumo dos cartões do usuário. Sem React/Supabase — apenas
// funções puras testáveis. Percentuais e contagens somente: os custos dos
// itens entram apenas como peso do EV/BAC e nunca são expostos.
import {
  calcularBAC,
  calcularEV,
  calcularPV,
  classificarIndice,
  type EvmItemCrono,
  type FaixaIndice,
} from "@/lib/pmbok/evm";
import { bucketPrazo } from "@/lib/cards/filtrosCards";

export type StatusItemCrono = "concluido" | "em_andamento" | "nao_iniciado";

export interface ItemCronoDashboard extends EvmItemCrono {
  obra_id: string | number;
}

export interface ResumoObra {
  totalItens: number;
  porStatus: Record<StatusItemCrono, number>;
  atrasados: number;
  /** % físico 0-100: EV/BAC ponderado por custo; média simples quando BAC=0. */
  percFisico: number;
  /** % previsto 0-100 na data de referência. */
  percPrevisto: number;
  /** SPI = EV/PV; null quando não calculável (BAC=0 ou PV=0). */
  spi: number | null;
  faixaSpi: FaixaIndice | null;
}

export interface CartaoMin {
  id: string;
  status: string | null;
  prazo: string | null;
}

export interface ResumoMeusCartoes {
  total: number;
  abertos: number;
  vencidos: number;
  venceHoje: number;
  vence7dias: number;
  concluidos: number;
}

/** Mesma régua do statusCpmPorPercentual do DashboardLean. */
export function statusItem(percentualRealizado: number | null): StatusItemCrono {
  const p = percentualRealizado ?? 0;
  if (p >= 100) return "concluido";
  if (p > 0) return "em_andamento";
  return "nao_iniciado";
}

/** Item com fim previsto no passado e execução incompleta. */
export function itemAtrasado(item: EvmItemCrono, hoje: Date): boolean {
  const fim = item.data_fim_baseline ?? item.data_fim;
  if (!fim) return false;
  const hojeIso = hoje.toISOString().slice(0, 10);
  return fim < hojeIso && (item.percentual_realizado ?? 0) < 100;
}

export function agruparPorObra(itens: ItemCronoDashboard[]): Map<string, EvmItemCrono[]> {
  const map = new Map<string, EvmItemCrono[]>();
  for (const item of itens) {
    if (item.ativo === false) continue;
    const key = String(item.obra_id);
    const lista = map.get(key);
    if (lista) lista.push(item);
    else map.set(key, [item]);
  }
  return map;
}

const media = (valores: Array<number | null>): number => {
  if (!valores.length) return 0;
  const soma = valores.reduce<number>((s, v) => s + (v ?? 0), 0);
  return soma / valores.length;
};

const clampPct = (v: number) => Math.min(100, Math.max(0, v));

export function resumirObra(itens: EvmItemCrono[], hoje: Date): ResumoObra {
  const porStatus: Record<StatusItemCrono, number> = {
    concluido: 0,
    em_andamento: 0,
    nao_iniciado: 0,
  };
  let atrasados = 0;
  for (const item of itens) {
    porStatus[statusItem(item.percentual_realizado)] += 1;
    if (itemAtrasado(item, hoje)) atrasados += 1;
  }

  const bac = calcularBAC(itens);
  let percFisico: number;
  let percPrevisto: number;
  let spi: number | null = null;
  if (bac > 0) {
    const ev = calcularEV(itens);
    const pv = calcularPV(itens, hoje);
    percFisico = clampPct((ev / bac) * 100);
    percPrevisto = clampPct((pv / bac) * 100);
    spi = pv > 0 ? ev / pv : null;
  } else {
    // Cronograma sem custos: cai para média simples dos percentuais.
    percFisico = clampPct(media(itens.map((i) => i.percentual_realizado)));
    percPrevisto = clampPct(media(itens.map((i) => i.percentual_previsto)));
  }

  return {
    totalItens: itens.length,
    porStatus,
    atrasados,
    percFisico,
    percPrevisto,
    spi,
    faixaSpi: spi === null ? null : classificarIndice(spi),
  };
}

/** Único status terminal é "concluido" (convenção do cardsRepo.listAbertosMin). */
export function cartaoConcluido(status: string | null): boolean {
  return status === "concluido";
}

export function resumirMeusCartoes(cartoes: CartaoMin[], hoje: Date): ResumoMeusCartoes {
  const resumo: ResumoMeusCartoes = {
    total: cartoes.length,
    abertos: 0,
    vencidos: 0,
    venceHoje: 0,
    vence7dias: 0,
    concluidos: 0,
  };
  for (const c of cartoes) {
    if (cartaoConcluido(c.status)) {
      resumo.concluidos += 1;
      continue;
    }
    resumo.abertos += 1;
    const bucket = bucketPrazo(c.prazo ?? null, hoje);
    if (bucket === "vencido") resumo.vencidos += 1;
    else if (bucket === "hoje") resumo.venceHoje += 1;
    else if (bucket === "semana") resumo.vence7dias += 1;
  }
  return resumo;
}
