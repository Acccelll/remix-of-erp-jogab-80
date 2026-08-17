// PRO-019 — Alertas de vencimento/renovação/reajuste de contratos (M12).
// Regra: considera contrato ativo cujo término efetivo OU próximo reajuste anual
// cai dentro dos próximos N dias (padrão 30) OU já venceu sem ação formal.
import { useMemo } from "react";
import { useContratosContext } from "@/contexts/ContratosContext";
import type { Contrato } from "@/types";

export const DIAS_ALERTA_CONTRATO_PADRAO = 30;

export type ContratoAlertaSeveridade = "critica" | "alta" | "media";

export interface ContratoAlerta {
  contrato: Contrato;
  tipo: "renovacao" | "reajuste";
  dataAlvo: string; // ISO date
  terminoEfetivo: string; // compat: para renovação é o término; para reajuste é a data-alvo
  diasRestantes: number; // negativo => vencido
  origem: "contrato" | "aditivo";
  situacao: "vencido" | "hoje" | "proximo";
  /** critica: vencido/hoje · alta: até 7 dias · media: demais dentro do horizonte. */
  severidade: ContratoAlertaSeveridade;
}

function parseData(s?: string): Date | null {
  if (!s) return null;
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function inicioDoDia(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addMeses(d: Date, meses: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + meses, d.getDate());
}

function terminoEfetivo(c: Contrato): { data: Date; origem: "contrato" | "aditivo" } | null {
  const prorrog = (c.aditivos ?? [])
    .map((a) => ({ data: parseData(a.novoTermino), origem: "aditivo" as const }))
    .filter((a): a is { data: Date; origem: "aditivo" } => !!a.data)
    .sort((a, b) => b.data.getTime() - a.data.getTime());
  if (prorrog.length > 0) {
    return prorrog[0];
  }
  const termino = parseData(c.termino);
  return termino ? { data: termino, origem: "contrato" } : null;
}

function proximoReajuste(c: Contrato): { data: Date; origem: "contrato" | "aditivo" } | null {
  const reajustes = (c.aditivos ?? [])
    .map((a) => (a.tipo === "reajuste" ? { data: parseData(a.data), origem: "aditivo" as const } : null))
    .filter((a): a is { data: Date; origem: "aditivo" } => !!a?.data)
    .sort((a, b) => b.data.getTime() - a.data.getTime());

  const base = reajustes[0] ?? { data: parseData(c.inicio), origem: "contrato" as const };
  if (!base.data) return null;

  const previsto = addMeses(base.data, 12);
  const termino = terminoEfetivo(c)?.data;
  if (termino && previsto > termino) return null;
  return { data: previsto, origem: base.origem };
}

function diffDias(destino: Date, hoje: Date): number {
  const a = Date.UTC(destino.getFullYear(), destino.getMonth(), destino.getDate());
  const b = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((a - b) / 86_400_000);
}

function criarAlerta(
  contrato: Contrato,
  tipo: ContratoAlerta["tipo"],
  alvo: { data: Date; origem: "contrato" | "aditivo" },
  diasAlerta: number,
  hoje: Date,
): ContratoAlerta | null {
  const dias = diffDias(alvo.data, hoje);
  if (dias > diasAlerta) return null;
  const dataAlvo = toISODate(alvo.data);
  const situacao = dias < 0 ? "vencido" : dias === 0 ? "hoje" : "proximo";
  const severidade: ContratoAlertaSeveridade =
    situacao === "vencido" || situacao === "hoje" ? "critica" : dias <= 7 ? "alta" : "media";
  return {
    contrato,
    tipo,
    dataAlvo,
    terminoEfetivo: dataAlvo,
    diasRestantes: dias,
    origem: alvo.origem,
    situacao,
    severidade,
  };
}

export function calcularAlertasContratos(
  contratos: Contrato[],
  diasAlerta = DIAS_ALERTA_CONTRATO_PADRAO,
  hoje = new Date(),
): ContratoAlerta[] {
  const hojeRef = inicioDoDia(hoje);
  const out: ContratoAlerta[] = [];
  for (const c of contratos) {
    if (!c.ativo || c.status === "encerrado" || c.status === "rascunho") continue;

    const renovacao = terminoEfetivo(c);
    if (renovacao) {
      const alerta = criarAlerta(c, "renovacao", renovacao, diasAlerta, hojeRef);
      if (alerta) out.push(alerta);
    }

    const reajuste = proximoReajuste(c);
    if (reajuste) {
      const alerta = criarAlerta(c, "reajuste", reajuste, diasAlerta, hojeRef);
      if (alerta) out.push(alerta);
    }
  }
  return out.sort((a, b) => a.diasRestantes - b.diasRestantes || a.tipo.localeCompare(b.tipo));
}

/** Hook consumidor: contratos "a vencer" para exibir em M12 e no sino. */
export function useContratosVencendo(diasAlerta = DIAS_ALERTA_CONTRATO_PADRAO) {
  const { contratos } = useContratosContext();
  return useMemo(() => calcularAlertasContratos(contratos, diasAlerta), [contratos, diasAlerta]);
}
