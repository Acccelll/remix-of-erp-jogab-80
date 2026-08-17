/** @module-kind pure */
// P0.2 — Derivação de data de vencimento para NFS-e.
// Reutiliza calcularVencimento() de @/lib/billing (regra prazo DDL + dias fixos).
// Não reimplementa a regra. Nunca lança.

import { calcularVencimento } from "@/lib/billing";

export type FonteVencimento = "manual" | "obra" | "cliente" | "indisponivel";

export type VencimentoDerivado = {
  data: string | null; // ISO YYYY-MM-DD
  fonte: FonteVencimento;
  prazoDias: number | null;
};

export type CondicaoPagamento = {
  prazo_pagamento_dias?: number | null;
  dias_fixos_pagamento?: number[] | null;
  dia_fixo_pagamento?: number | null;
} | null | undefined;

type DerivarArgs = {
  dataEmissao: string | null | undefined;
  dataVencimentoManual?: string | null;
  obra?: CondicaoPagamento;
  cliente?: CondicaoPagamento;
};

const INDISP: VencimentoDerivado = { data: null, fonte: "indisponivel", prazoDias: null };

function parseISO(s: string | null | undefined): Date | null {
  if (!s || typeof s !== "string") return null;
  // aceita "YYYY-MM-DD" ou "YYYY-MM-DDTHH..."
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function diasFixosDe(c: CondicaoPagamento): number[] {
  if (!c) return [];
  const arr = Array.isArray(c.dias_fixos_pagamento) ? c.dias_fixos_pagamento : null;
  if (arr && arr.length > 0) {
    return arr.filter((d) => Number.isFinite(d) && d >= 1 && d <= 31);
  }
  if (c.dia_fixo_pagamento != null && Number.isFinite(c.dia_fixo_pagamento)) {
    const n = Number(c.dia_fixo_pagamento);
    if (n >= 1 && n <= 31) return [n];
  }
  return [];
}

function derivarDe(
  emissao: Date,
  c: CondicaoPagamento,
): { data: string; prazoDias: number } | null {
  if (!c) return null;
  const prazo = c.prazo_pagamento_dias;
  if (prazo == null || !Number.isFinite(prazo) || prazo < 0) return null;
  try {
    const d = calcularVencimento(emissao, Number(prazo), diasFixosDe(c));
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
    return { data: toISO(d), prazoDias: Number(prazo) };
  } catch {
    return null;
  }
}

export function derivarVencimento(args: DerivarArgs): VencimentoDerivado {
  try {
    if (args.dataVencimentoManual) {
      const d = parseISO(args.dataVencimentoManual);
      if (d) return { data: toISO(d), fonte: "manual", prazoDias: null };
    }
    const emissao = parseISO(args.dataEmissao ?? null);
    if (!emissao) return INDISP;

    const obra = derivarDe(emissao, args.obra ?? null);
    if (obra) return { data: obra.data, fonte: "obra", prazoDias: obra.prazoDias };

    const cli = derivarDe(emissao, args.cliente ?? null);
    if (cli) return { data: cli.data, fonte: "cliente", prazoDias: cli.prazoDias };

    return INDISP;
  } catch {
    return INDISP;
  }
}
