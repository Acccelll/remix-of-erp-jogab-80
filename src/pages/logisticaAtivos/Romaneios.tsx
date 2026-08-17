import { useState } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { usePermissions } from "@/contexts/auth/usePermissions";
import { useObrasContext } from "@/contexts/ObrasContext";
import { useRomaneios } from "@/hooks/logisticaAtivos/useRomaneios";
import { ROMANEIO_STATUS_LABEL, type RomaneioStatus } from "@/lib/logisticaAtivos/status";
import RomaneioFormDialog from "@/components/logisticaAtivos/RomaneioFormDialog";
import RomaneioDetalheDialog from "@/components/logisticaAtivos/RomaneioDetalheDialog";

const STATUS_VARIANT: Record<RomaneioStatus, "default" | "secondary" | "destructive" | "outline"> =
  {
    rascunho: "outline",
    estoque_baixado: "secondary",
    confirmado: "default",
    confirmado_parcial: "secondary",
    falha_estoque: "destructive",
    cancelado: "outline",
  };

export default function Romaneios() {
  const { currentPlayer } = usePermissions();
  const { obras } = useObrasContext();
  const [statusFiltro, setStatusFiltro] = useState<string>("");
  const [obraFiltro, setObraFiltro] = useState<string>("");
  const [selecionado, setSelecionado] = useState<string | null>(null);

  const { data: romaneios = [], isLoading } = useRomaneios({
    status: statusFiltro || undefined,
    obraId: obraFiltro || undefined,
  });

  const obraById = Object.fromEntries(obras.map((o) => [o.id, o.nome]));

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-display font-semibold">Romaneios</h1>
        <RomaneioFormDialog criadoPorNome={currentPlayer?.login} onCreated={setSelecionado} />
      </div>

      <div className="flex gap-3">
        <div>
          <Label className="text-xs">Status</Label>
          <Select value={statusFiltro} onValueChange={setStatusFiltro}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ROMANEIO_STATUS_LABEL).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Obra</Label>
          <Select value={obraFiltro} onValueChange={setObraFiltro}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              {obras.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Destino</TableHead>
              <TableHead>Data programada</TableHead>
              <TableHead>Criado por</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {romaneios.map((r) => (
              <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelecionado(r.id)}>
                <TableCell className="font-medium">{r.numero}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[r.status as RomaneioStatus]}>
                    {ROMANEIO_STATUS_LABEL[r.status as RomaneioStatus]}
                  </Badge>
                </TableCell>
                <TableCell>{obraById[r.obra_destino_id] ?? "—"}</TableCell>
                <TableCell>{r.data_programada ?? "—"}</TableCell>
                <TableCell>{r.criado_por_nome ?? "—"}</TableCell>
              </TableRow>
            ))}
            {romaneios.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Nenhum romaneio encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <RomaneioDetalheDialog romaneioId={selecionado} onClose={() => setSelecionado(null)} />
    </div>
  );
}
