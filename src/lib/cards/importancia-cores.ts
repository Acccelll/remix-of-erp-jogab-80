/** @module-kind pure */
/**
 * Cores das classes de importância do cronograma (Gantt, Caminho Crítico,
 * legendas e badges). Centralizado para evitar divergência entre telas.
 *
 * Estas SÃO cores semânticas do domínio (criticidade), não cores neutras
 * do tema — por isso são tratadas como tokens de domínio e mapeadas
 * para tokens do design system quando possível.
 */
export type Importancia = "Crítica" | "Alta" | "Média" | "Baixa" | null | undefined;

/** Classe utilitária de background para um marcador/quadradinho. */
export function importanciaBgClass(c: Importancia): string {
  switch (c) {
    case "Crítica":
      return "bg-destructive";
    case "Alta":
      return "bg-warning";
    case "Média":
      return "bg-warning/60";
    case "Baixa":
      return "bg-muted-foreground/40";
    default:
      return "bg-muted-foreground/30";
  }
}

/** Variante de Badge correspondente (shadcn). */
export function importanciaBadgeVariant(
  c: Importancia,
): "destructive" | "secondary" | "outline" | "default" {
  switch (c) {
    case "Crítica":
      return "destructive";
    case "Alta":
      return "default";
    case "Média":
      return "secondary";
    case "Baixa":
      return "outline";
    default:
      return "outline";
  }
}

/** Itens da legenda (label + classe). Mesma ordem em todas as telas. */
export const IMPORTANCIA_LEGENDA: ReadonlyArray<{
  label: Exclude<Importancia, null | undefined>;
  bg: string;
}> = [
  { label: "Crítica", bg: importanciaBgClass("Crítica") },
  { label: "Alta", bg: importanciaBgClass("Alta") },
  { label: "Média", bg: importanciaBgClass("Média") },
  { label: "Baixa", bg: importanciaBgClass("Baixa") },
];
