// Shared types and constants for FinDividas subcomponents.
export type PgtoBucket = "pago" | "vencido" | "hoje" | "avencer";

export const PGTO_BUCKETS: PgtoBucket[] = ["pago", "vencido", "hoje", "avencer"];

export const PGTO_BUCKET_LABEL: Record<PgtoBucket, string> = {
  pago: "Pagos",
  vencido: "Vencidos",
  hoje: "Vencendo hoje",
  avencer: "A vencer",
};

export const PGTO_LABEL: Record<"avista" | "aprazo" | "indef", string> = {
  avista: "À vista",
  aprazo: "A prazo",
  indef: "Sem datas",
};

export type Tone = "danger" | "warn" | "neutral";

export type NatRow = {
  cod: string;
  desc: string;
  valor: number;
  vencido: number;
  aVencer: number;
  pct: number;
};

export type CentroRow = {
  codigo: string;
  nome: string;
  vencido: number;
  aVencer: number;
  valor: number;
  pct: number;
  titulos: number;
};
