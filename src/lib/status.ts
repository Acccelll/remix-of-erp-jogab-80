/** @module-kind pure */
/**
 * Catálogo de status por domínio (DS-005).
 *
 * Cada domínio expõe seu par `LABEL`/`VARIANT` (ou `COLORS`) para eliminar
 * as duplicações espalhadas por 15 arquivos. Componentes devem importar daqui
 * em vez de redeclarar mapas locais.
 */

type Variant = "default" | "secondary" | "outline" | "destructive";

// ---- Suprimentos: Ordens de Compra ----
export const STATUS_OC_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  emitida: "Emitida",
  recebida_parcial: "Recebida parcial",
  recebida: "Recebida",
  cancelada: "Cancelada",
};
export const STATUS_OC_VARIANT: Record<string, Variant> = {
  rascunho: "secondary",
  emitida: "default",
  recebida_parcial: "outline",
  recebida: "outline",
  cancelada: "outline",
};

// ---- Suprimentos: Requisições ----
export const STATUS_REQUISICAO_LABEL: Record<string, string> = {
  aberta: "Aberta",
  cotando: "Cotando",
  atendida: "Atendida",
  cancelada: "Cancelada",
};
export const STATUS_REQUISICAO_VARIANT: Record<string, Variant> = {
  aberta: "default",
  cotando: "secondary",
  atendida: "outline",
  cancelada: "outline",
};

// ---- Planejamento: Pacotes de Trabalho ----
export const STATUS_PACOTE_LABEL: Record<string, string> = {
  planejado: "Planejado",
  comprometido: "Comprometido",
  concluido: "Concluído",
  cancelado: "Cancelado",
};
export const STATUS_PACOTE_VARIANT: Record<string, Variant> = {
  planejado: "outline",
  comprometido: "default",
  concluido: "secondary",
  cancelado: "destructive",
};
export const STATUS_PACOTE_ORDER: Array<keyof typeof STATUS_PACOTE_LABEL> = [
  "planejado",
  "comprometido",
  "concluido",
  "cancelado",
];

// ---- Planejamento: Riscos (nível programa) ----
export const STATUS_RISCO_PROGRAMA_OPCOES = [
  "aberto",
  "em_andamento",
  "mitigado",
  "encerrado",
] as const;
export const STATUS_RISCO_PROGRAMA_LABEL: Record<string, string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  mitigado: "Mitigado",
  encerrado: "Encerrado",
};

// ---- Obra: Riscos ----
export const STATUS_RISCO_OBRA_OPCOES = [
  "identificado",
  "em_analise",
  "em_tratamento",
  "materializado",
  "encerrado",
] as const;
export const STATUS_RISCO_OBRA_LABEL: Record<string, string> = {
  identificado: "Identificado",
  em_analise: "Em análise",
  em_tratamento: "Em tratamento",
  materializado: "Materializado",
  encerrado: "Encerrado",
};

// ---- Obra: Ocorrências ----
export const STATUS_OCORRENCIA_OPCOES = [
  "aberta",
  "em_andamento",
  "resolvida",
  "cancelada",
] as const;
export const STATUS_OCORRENCIA_LABEL: Record<string, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  resolvida: "Resolvida",
  cancelada: "Cancelada",
};

// ---- Obra: Aditivos (variante de badge) ----
export const STATUS_ADITIVO_VARIANT: Record<string, Variant> = {
  rascunho: "secondary",
  aprovado: "default",
  cancelado: "destructive",
};

// ---- Não Conformidades ----
export const STATUS_NC_LABEL: Record<string, string> = {
  aberta: "Aberta",
  em_tratativa: "Em tratativa",
  aguardando_reinspecao: "Aguardando reinspeção",
  resolvida: "Resolvida",
  cancelada: "Cancelada",
};
export const STATUS_NC_COLOR: Record<string, string> = {
  aberta: "bg-sev-critica/15 text-sev-critica border-sev-critica/40",
  em_tratativa: "bg-primary/10 text-primary border-primary/30",
  aguardando_reinspecao: "bg-accent/15 text-accent-foreground border-accent/40",
  resolvida: "bg-sev-baixa/15 text-sev-baixa border-sev-baixa/40",
  cancelada: "bg-muted text-muted-foreground border-border",
};


// ---- Cards: Recurso (trilho de compras) ----
export const STATUS_RECURSO_LABEL: Record<string, string> = {
  identificado: "Identificado",
  em_cotacao: "Em cotação",
  pedido_emitido: "Pedido emitido",
  aguardando_entrega: "Aguardando entrega",
  entregue: "Entregue",
  concluido: "Concluído",
  materia_entregue: "Matéria entregue",
  aguardando_material: "Aguardando material",
  em_fabricacao: "Em fabricação",
  produzido: "Produzido",
  entregue_obra: "Entregue na obra",
};

// ---- Dashboard: Portfólio de Obras ----
export const STATUS_OBRA_LABEL: Record<string, string> = {
  planejada: "Planejada",
  em_andamento: "Em andamento",
  paralisada: "Paralisada",
  concluida: "Concluída",
  cancelada: "Cancelada",
};
export const STATUS_OBRA_COLOR: Record<string, string> = {
  planejada: "#3b82f6",
  em_andamento: "#f59e0b",
  paralisada: "#fb923c",
  concluida: "#16a34a",
  cancelada: "#94a3b8",
};
