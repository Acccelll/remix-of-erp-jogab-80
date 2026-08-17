import React from "react";
import { Info } from "lucide-react";
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * "i" em círculo que revela uma explicação curta em balão. Para rótulos cujo
 * nome não se explica sozinho — composição de um valor, critério de um campo.
 * O `TooltipProvider` que o Radix exige é global (`AppProviders`), então basta
 * usar o componente onde for preciso.
 *
 * `compacto` existe para o corpo 11px da legenda do gráfico de Custos, onde o
 * ícone de 14px fica desproporcional. Medido: o "i" alarga o item em ~16px e
 * antecipa a quebra da legenda para duas linhas de ~500px para ~545px de
 * largura útil — some nessa faixa estreita, não em todas.
 */
export default function InfoDica({
  texto,
  rotulo,
  compacto,
}: {
  texto: string;
  rotulo?: string;
  compacto?: boolean;
}) {
  return (
    <UITooltip>
      <TooltipTrigger asChild>
        <Info
          className={`${compacto ? "h-3 w-3" : "h-3.5 w-3.5"} text-muted-foreground cursor-help shrink-0`}
          aria-label={rotulo ?? "Mais informações"}
        />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[280px] text-xs">
        {texto}
      </TooltipContent>
    </UITooltip>
  );
}
