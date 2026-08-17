import React from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Clock, Truck, Users } from "lucide-react";
import type { Colaborador, Veiculo, Contrato } from "@/types";

export interface BoardColumnCountProps {
  colCards: Colaborador[];
  colVeiculos: Veiculo[];
  colContratos: Contrato[];
  pendentes: Array<{ nome: string; origem: string; data: string }>;
}

const BoardColumnCount: React.FC<BoardColumnCountProps> = ({
  colCards,
  colVeiculos,
  colContratos,
  pendentes,
}) => {
  const totalEquip = colVeiculos.length + colContratos.length;
  const funcCounts = colCards.reduce<Record<string, number>>((acc, c) => {
    acc[c.funcao || "Sem função"] = (acc[c.funcao || "Sem função"] || 0) + 1;
    return acc;
  }, {});
  const veicCounts = colVeiculos.reduce<Record<string, number>>((acc, v) => {
    acc[v.tipo || "Sem tipo"] = (acc[v.tipo || "Sem tipo"] || 0) + 1;
    return acc;
  }, {});
  const contratoCounts = colContratos.reduce<Record<string, number>>((acc, c) => {
    const k = `${c.tipoMaquina || "Sem tipo"} (Contrato)`;
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="flex items-center gap-1 cursor-default shrink-0">
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary text-muted-foreground text-[11px] font-medium px-1.5 py-0.5">
              <Users className="h-3 w-3" />
              {colCards.length}
            </span>
            {totalEquip > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-[11px] font-medium px-1.5 py-0.5">
                <Truck className="h-3 w-3" />
                {totalEquip}
              </span>
            )}
            {pendentes.length > 0 && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-warning/15 text-warning text-[11px] font-medium px-1.5 py-0.5"
                aria-label={`${pendentes.length} mobilização pendente para esta coluna`}
              >
                <Clock className="h-3 w-3" />
                {pendentes.length}
              </span>
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {colCards.length === 0 && totalEquip === 0 && pendentes.length === 0 ? (
            <p>Nenhum colaborador</p>
          ) : (
            <div className="space-y-1.5">
              {colCards.length > 0 && (
                <div>
                  <p className="font-semibold border-b border-border pb-0.5 mb-1">Colaboradores</p>
                  {Object.entries(funcCounts).map(([f, n]) => (
                    <p key={f}>
                      {f}: {n}
                    </p>
                  ))}
                </div>
              )}
              {totalEquip > 0 && (
                <div>
                  <p className="font-semibold border-b border-border pb-0.5 mb-1">
                    Veículos / Equipamentos
                  </p>
                  {Object.entries(veicCounts).map(([t, n]) => (
                    <p key={t}>
                      {t}: {n}
                    </p>
                  ))}
                  {Object.entries(contratoCounts).map(([t, n]) => (
                    <p key={t}>
                      {t}: {n}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
          {pendentes.length > 0 && (
            <div className="mt-1.5 max-w-[260px]">
              <p className="font-semibold border-b border-border pb-0.5 mb-1 text-warning flex items-center gap-1">
                <Clock className="h-3 w-3" /> Mobilizações pendentes ({pendentes.length})
              </p>
              <ul className="space-y-0.5 max-h-32 overflow-auto">
                {pendentes.map((p, i) => (
                  <li key={i} className="truncate">
                    <span className="font-medium">{p.nome}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      — de "{p.origem}" em {p.data}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default BoardColumnCount;
