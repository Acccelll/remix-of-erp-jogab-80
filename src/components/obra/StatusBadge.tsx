import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusTipo = "bms" | "medicao" | "nf" | "receb";

type Tone = "muted" | "info" | "success" | "warning" | "destructive";

const TONE_CLASSES: Record<Tone, string> = {
  muted: "bg-muted text-muted-foreground border-transparent",
  info: "bg-[color:var(--info)]/15 text-[color:var(--info)] border-[color:var(--info)]/20",
  success:
    "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/20",
  warning:
    "bg-[color:var(--warning)]/20 text-[color:var(--warning-foreground)] border-[color:var(--warning)]/30 dark:text-[color:var(--warning)]",
  destructive: "bg-destructive/15 text-destructive border-destructive/20",
};

const LABELS: Record<string, string> = {
  // BMS
  prevista: "Prevista",
  aberta: "Aberta",
  fechada: "Fechada",
  faturada: "Faturada",
  cancelada: "Cancelada",
  // Medição
  rascunho: "Rascunho",
  enviada: "Enviada",
  aprovada: "Aprovada",
  rejeitada: "Rejeitada",
  // NF
  emitida: "Emitida",
  paga: "Paga",
  // Recebimento
  previsto: "Previsto",
  a_receber: "A receber",
  pago: "Pago",
  atrasado: "Atrasado",
  antecipado: "Antecipado",
  inadimplente: "Inadimplente",
};

function toneFor(tipo: StatusTipo, status: string): Tone {
  const s = (status ?? "").toLowerCase();
  // Universais
  if (s === "cancelada" || s === "cancelado" || s === "rejeitada" || s === "inadimplente")
    return "destructive";
  if (s === "atrasado") return "warning";

  switch (tipo) {
    case "bms":
      if (s === "prevista") return "muted";
      if (s === "aberta") return "info";
      if (s === "fechada") return "success";
      if (s === "faturada") return "success";
      if (s === "paga") return "success";
      return "muted";
    case "medicao":
      if (s === "rascunho") return "muted";
      if (s === "enviada") return "info";
      if (s === "aprovada") return "success";
      return "muted";
    case "nf":
      if (s === "rascunho") return "muted";
      if (s === "emitida") return "info";
      if (s === "paga") return "success";
      return "muted";
    case "receb":
      if (s === "previsto") return "muted";
      if (s === "a_receber") return "info";
      if (s === "pago") return "success";
      if (s === "antecipado") return "info";
      return "muted";
  }
}

export function StatusBadge({
  tipo,
  status,
  className,
}: {
  tipo: StatusTipo;
  status: string;
  className?: string;
}) {
  const tone = toneFor(tipo, status);
  const label = LABELS[status] ?? status;
  return (
    <Badge variant="outline" className={cn("font-medium", TONE_CLASSES[tone], className)}>
      {label}
    </Badge>
  );
}
