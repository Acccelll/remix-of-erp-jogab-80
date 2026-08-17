import type { NivelPrioridade, StatusSolicitacao } from "@/types";
import { fmtDataLocal } from "@/lib/core/date";

export const statusLabels: Record<StatusSolicitacao, string> = {
  em_analise: "Em Análise",
  aprovado: "Aprovado",
  reprovado: "Reprovado",
  cancelado: "Cancelado",
};

export const statusColors: Record<StatusSolicitacao, string> = {
  em_analise: "bg-warning/15 text-warning border-warning/30",
  aprovado: "bg-success/15 text-success border-success/30",
  reprovado: "bg-destructive/10 text-destructive border-destructive/30",
  cancelado: "bg-destructive/10 text-destructive border-destructive/30",
};

export const prioridadeLabels: Record<NivelPrioridade, string> = {
  baixa: "Baixa",
  normal: "Normal",
  alta: "Importante",
  urgente: "Urgente",
};

export const prioridadeColors: Record<NivelPrioridade, string> = {
  baixa: "bg-success/15 text-success border-success/40",
  normal: "bg-warning/15 text-warning border-warning/40",
  alta: "bg-orange-500/15 text-orange-700 border-orange-500/40 dark:text-orange-400",
  urgente: "bg-destructive/15 text-destructive border-destructive/40",
};

export const SETORES = ["RH", "Compras", "Almoxarifado", "Frotas", "Engenharia"];
export const ITEMS_PER_PAGE = 10;

export const STATUS_OPTIONS: { value: StatusSolicitacao; label: string }[] = [
  { value: "em_analise", label: "Em Análise" },
  { value: "aprovado", label: "Aprovado" },
  { value: "reprovado", label: "Reprovado" },
  { value: "cancelado", label: "Cancelado" },
];

export interface Solicitacao {
  id: string;
  setor: string;
  valor: number;
  data_pagamento: string | null;
  prazo_estimado: string | null;
  forma_pagamento_id: string | null;
  nivel_prioridade: string;
  condicao_pagamento: string | null;
  centro_custo_id: string | null;
  solicitante: string;
  fornecedor: string | null;
  referencia: string | null;
  observacao: string | null;
  status: StatusSolicitacao;
  comentario_aprovacao: string | null;
  criado_por: string;
  created_at: string;
  updated_at: string;
  pagamento_pendente?: boolean;
  /** Valor ainda provisório — destaca a linha em âmbar na fila de aprovação. */
  previsao?: boolean;
}

export interface Comentario {
  id: string;
  solicitacao_id: string;
  campo: string;
  texto: string;
  autor: string;
  created_at: string;
}

export interface FormaPag {
  id: string;
  nome: string;
  tipo: string;
  ativo: boolean;
}

export type SortField =
  | "setor"
  | "valor"
  | "solicitante"
  | "fornecedor"
  | "centro_custo"
  | "referencia"
  | "status"
  | "prioridade"
  | "created_at"
  | "updated_at"
  | "data_pagamento"
  | "prazo_estimado";

export type SortDir = "asc" | "desc" | null;

/** Formata YYYY-MM-DD (ou ISO) em DD/MM/YYYY sem deslocamento de fuso horário. */
export const formatDateBR = (value?: string | null): string => {
  if (!value) return "—";
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${d}/${m}/${y}`;
  }
  const dt = new Date(value);
  if (isNaN(dt.getTime())) return value;
  return fmtDataLocal(dt);
};

/** Formata timestamp em DD/MM/YYYY HH:mm */
export const formatDateTimeBR = (value?: string | null): string => {
  if (!value) return "—";
  const dt = new Date(value);
  if (isNaN(dt.getTime())) return value;
  return dt.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};
