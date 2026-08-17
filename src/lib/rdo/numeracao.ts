/** @module-kind pure */
// PRO-005 · slice-01 — Numeração sequencial + trava (fechamento) local do RDO.
//
// Regras puras: geração do próximo número por obra/ano, formatação canônica
// e verificação de trava. Persistência fica no hook `useRdoNumeracaoLocal`.

export const RDO_PREFIXO = "RDO";

export interface RdoRegistroLocal {
  /** id do RDO (mesmo id do backend quando existir). */
  id: string;
  obraId: string;
  /** Empresa usada para numeração parametrizada (PRO-031), quando conhecida. */
  empresaId?: string;
  ano: number;
  sequencial: number;
  numero: string; // ex.: RDO-2026-0001
  fechado: boolean;
  fechadoEm?: string;
  fechadoPor?: string;
  assinadoEm?: string;
  assinadoPor?: string;
  assinaturaDataUrl?: string;
}

export interface RdoAssinaturaLocal {
  assinadoPor: string;
  assinaturaDataUrl: string;
  assinadoEm?: string;
}

/** Formata `RDO-<ano>-<seq 4 dígitos>`. */
export function formatarNumeroRdo(ano: number, sequencial: number): string {
  const seq = String(sequencial).padStart(4, "0");
  return `${RDO_PREFIXO}-${ano}-${seq}`;
}

/** Próximo sequencial disponível para uma obra/ano dado o histórico local. */
export function proximoSequencial(
  registros: RdoRegistroLocal[],
  obraId: string,
  ano: number,
): number {
  const usados = registros
    .filter((r) => r.obraId === obraId && r.ano === ano)
    .map((r) => r.sequencial);
  return usados.length === 0 ? 1 : Math.max(...usados) + 1;
}

export interface GerarNumeroInput {
  obraId: string;
  data?: string | Date;
  registros: RdoRegistroLocal[];
}

export interface NumeroRdoGerado {
  ano: number;
  sequencial: number;
  numero: string;
}

/** Gera número canônico usando o ano da data do RDO (default: hoje). */
export function gerarNumeroRdo(input: GerarNumeroInput): NumeroRdoGerado {
  const d = input.data ? new Date(input.data) : new Date();
  if (Number.isNaN(d.getTime())) throw new Error("Data inválida para gerar número de RDO.");
  const ano = d.getFullYear();
  const sequencial = proximoSequencial(input.registros, input.obraId, ano);
  return { ano, sequencial, numero: formatarNumeroRdo(ano, sequencial) };
}

export interface ValidacaoTrava {
  ok: boolean;
  motivo?: string;
}

/** Regra de trava: RDO fechado não pode ser editado nem re-fechado. */
export function podeEditar(reg: RdoRegistroLocal | undefined | null): ValidacaoTrava {
  if (!reg) return { ok: true };
  if (reg.fechado) return { ok: false, motivo: `RDO ${reg.numero} está fechado.` };
  return { ok: true };
}

export function podeFechar(reg: RdoRegistroLocal | undefined | null): ValidacaoTrava {
  if (!reg) return { ok: false, motivo: "RDO não encontrado." };
  if (reg.fechado) return { ok: false, motivo: `RDO ${reg.numero} já está fechado.` };
  return { ok: true };
}

/** Assinatura local é única: depois de registrada, não é sobrescrita. */
export function podeAssinar(reg: RdoRegistroLocal | undefined | null): ValidacaoTrava {
  if (!reg) return { ok: false, motivo: "RDO não encontrado." };
  if (reg.assinaturaDataUrl) return { ok: false, motivo: `RDO ${reg.numero} já está assinado.` };
  return { ok: true };
}

export function validarAssinatura(input: RdoAssinaturaLocal): ValidacaoTrava {
  if (!input.assinadoPor.trim()) return { ok: false, motivo: "Informe o responsável pela assinatura." };
  if (!input.assinaturaDataUrl.startsWith("data:image/")) {
    return { ok: false, motivo: "Assinatura inválida." };
  }
  return { ok: true };
}

/** Detecta colisão de número (paranoia contra duplicação por corrida). */
export function numeroDuplicado(
  registros: RdoRegistroLocal[],
  numero: string,
  ignorarId?: string,
): boolean {
  return registros.some((r) => r.numero === numero && r.id !== ignorarId);
}
