import { Link } from "react-router-dom";
import { Layers, Building2, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * UX-007 — Banner de escopo para Riscos e Lições Aprendidas.
 *
 * Deixa explícito de onde vêm os dados exibidos e oferece navegação cruzada
 * entre os dois níveis (portfólio × obra), para eliminar a ambiguidade
 * apontada no achado.
 */

type NivelPortfolio = {
  nivel: "portfolio";
  /** Módulo — usado no rótulo e nos links cruzados. */
  modulo: "riscos" | "licoes";
  /** Nome da obra atualmente filtrada, quando `filtroObraId` != "todas". */
  obraFiltradaNome?: string | null;
  /** ID da obra filtrada — habilita o CTA "Abrir na obra". */
  obraFiltradaId?: string | null;
};

type NivelObra = {
  nivel: "obra";
  modulo: "riscos" | "licoes";
  obraNome?: string | null;
};

export type EscopoBannerProps = NivelPortfolio | NivelObra;

const MODULO_LABEL: Record<"riscos" | "licoes", string> = {
  riscos: "Riscos",
  licoes: "Lições aprendidas",
};

const PORTFOLIO_HREF: Record<"riscos" | "licoes", string> = {
  riscos: "/planejamento/riscos",
  licoes: "/planejamento/licoes-aprendidas",
};

export function EscopoBanner(props: EscopoBannerProps) {
  if (props.nivel === "portfolio") {
    const { modulo, obraFiltradaId, obraFiltradaNome } = props;
    return (
      <div
        role="note"
        aria-label="Escopo dos dados"
        className="flex items-start gap-3 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm"
      >
        <Layers className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <div className="flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="uppercase tracking-wide">
              Portfólio
            </Badge>
            <span className="font-medium">
              {MODULO_LABEL[modulo]} consolidados de todas as obras
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {obraFiltradaId && obraFiltradaNome
              ? `Visão do programa filtrada por obra: ${obraFiltradaNome}. Os mesmos registros aparecem no detalhe da obra.`
              : "Visão do programa. Cada registro pertence a uma obra e também é exibido no detalhe dela."}
          </p>
        </div>
        {obraFiltradaId && modulo === "riscos" && (
          <Button asChild size="sm" variant="outline" className="shrink-0">
            <Link to={`/obras/${obraFiltradaId}?tab=riscos`}>
              Abrir na obra
              <ArrowUpRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </Button>
        )}
      </div>
    );
  }

  const { modulo, obraNome } = props;
  return (
    <div
      role="note"
      aria-label="Escopo dos dados"
      className="flex items-start gap-3 rounded-md border bg-muted/40 p-3 text-sm"
    >
      <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="uppercase tracking-wide">
            Obra
          </Badge>
          <span className="font-medium">
            {MODULO_LABEL[modulo]} desta obra{obraNome ? ` — ${obraNome}` : ""}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Os registros criados aqui alimentam a visão consolidada em Planejamento.
        </p>
      </div>
      <Button asChild size="sm" variant="ghost" className="shrink-0">
        <Link to={PORTFOLIO_HREF[modulo]}>
          Ver no portfólio
          <ArrowUpRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </Button>
    </div>
  );
}
