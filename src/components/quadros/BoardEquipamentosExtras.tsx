import React, { useState } from "react";
import { Truck, ChevronsUpDown } from "lucide-react";
import type { Veiculo, Contrato } from "@/types";

export interface BoardEquipamentosExtrasProps {
  columnKey: string;
  veiculos: Veiculo[];
  contratos: Contrato[];
}

/**
 * Expansor de equipamentos (veículos vinculados ao motorista + contratos de
 * locação de máquina) por coluna do Gestão de Equipe. Encapsula o estado
 * local para que o board principal fique mais limpo.
 */
const BoardEquipamentosExtras: React.FC<BoardEquipamentosExtrasProps> = ({
  columnKey: _columnKey,
  veiculos,
  contratos,
}) => {
  const [open, setOpen] = useState(false);
  const total = veiculos.length + contratos.length;
  if (total === 0) return null;

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full text-[10px] uppercase tracking-wide text-muted-foreground hover:text-foreground inline-flex items-center justify-between gap-1 px-1 py-0.5"
      >
        <span className="inline-flex items-center gap-1">
          <Truck className="h-3 w-3" /> Equipamentos ({total})
        </span>
        <ChevronsUpDown className="h-3 w-3 opacity-60" />
      </button>
      {open && (
        <div className="mt-1 rounded-md border border-border/60 bg-secondary/40 p-1.5 space-y-1">
          {veiculos.map((v) => (
            <div key={`v-${v.id}`} className="text-[11px] flex items-center gap-1.5">
              <Truck className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="truncate">
                <span className="font-medium">{v.codigo}</span> · {v.nome}
                <span className="text-muted-foreground"> · {v.tipo}</span>
              </span>
            </div>
          ))}
          {contratos.map((c) => (
            <div key={`c-${c.id}`} className="text-[11px] flex items-center gap-1.5">
              <Truck className="h-3 w-3 text-primary shrink-0" />
              <span className="truncate">
                <span className="font-medium">{c.locacaoServico}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {c.tipoMaquina || "Máquina"} · Contrato
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BoardEquipamentosExtras;
