import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { usePermissions } from "@/contexts/auth/usePermissions";
import { useObrasContext } from "@/contexts/ObrasContext";
import { useRomaneios, type RomaneioResumo } from "@/hooks/logisticaAtivos/useRomaneios";
import { ROMANEIO_STATUS_LABEL, type RomaneioStatus } from "@/lib/logisticaAtivos/status";
import RomaneioFormDialog from "@/components/logisticaAtivos/RomaneioFormDialog";
import RomaneioDetalheDialog from "@/components/logisticaAtivos/RomaneioDetalheDialog";

const COLUNAS: RomaneioStatus[] = [
  "rascunho",
  "estoque_baixado",
  "confirmado",
  "confirmado_parcial",
  "falha_estoque",
  "cancelado",
];

export default function QuadroRomaneios() {
  const { currentPlayer } = usePermissions();
  const { obras } = useObrasContext();
  const { data: romaneios = [], isLoading } = useRomaneios();
  const [selecionado, setSelecionado] = useState<string | null>(null);

  const obraById = Object.fromEntries(obras.map((o) => [o.id, o.nome]));

  const porStatus = COLUNAS.reduce<Record<RomaneioStatus, RomaneioResumo[]>>(
    (acc, status) => {
      acc[status] = romaneios.filter((r) => r.status === status);
      return acc;
    },
    {} as Record<RomaneioStatus, RomaneioResumo[]>,
  );

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-display font-semibold">Quadro de Romaneios</h1>
        <RomaneioFormDialog criadoPorNome={currentPlayer?.login} onCreated={setSelecionado} />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUNAS.map((status) => (
            <div key={status} className="min-w-64 flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-medium">{ROMANEIO_STATUS_LABEL[status]}</h2>
                <Badge variant="outline">{porStatus[status].length}</Badge>
              </div>
              <div className="space-y-2">
                {porStatus[status].map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelecionado(r.id)}
                    className="w-full text-left rounded-md border bg-card p-3 text-sm hover:bg-accent transition-colors"
                  >
                    <p className="font-medium">{r.numero}</p>
                    <p className="text-muted-foreground text-xs">
                      {obraById[r.obra_destino_id] ?? "—"}
                    </p>
                    {r.data_programada && (
                      <p className="text-muted-foreground text-xs">{r.data_programada}</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <RomaneioDetalheDialog romaneioId={selecionado} onClose={() => setSelecionado(null)} />
    </div>
  );
}
