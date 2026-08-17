import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileDown, Loader2, X } from "lucide-react";
import { useObrasContext } from "@/contexts/ObrasContext";
import { useVeiculosContext } from "@/contexts/VeiculosContext";
import { useInsumosAtivosBasico } from "@/hooks/suprimentos/useInsumos";
import { useRomaneioDetalhe } from "@/hooks/logisticaAtivos/useRomaneioDetalhe";
import { useCancelarRomaneio } from "@/hooks/logisticaAtivos/useRomaneios";
import { useConfirmarRomaneio } from "@/hooks/logisticaAtivos/useConfirmarRomaneio";
import {
  ROMANEIO_STATUS_LABEL,
  isRomaneioEditavel,
  type RomaneioStatus,
} from "@/lib/logisticaAtivos/status";
import { exportRomaneioToPDF } from "@/lib/logisticaAtivos/romaneio-pdf";
import RomaneioItensEstoqueField from "./RomaneioItensEstoqueField";
import RomaneioItensPatrimonioField from "./RomaneioItensPatrimonioField";
import RomaneioVeiculoField from "./RomaneioVeiculoField";
import RomaneioConfirmarDialog from "./RomaneioConfirmarDialog";

interface Props {
  romaneioId: string | null;
  onClose: () => void;
}

const STATUS_VARIANT: Record<RomaneioStatus, "default" | "secondary" | "destructive" | "outline"> =
  {
    rascunho: "outline",
    estoque_baixado: "secondary",
    confirmado: "default",
    confirmado_parcial: "secondary",
    falha_estoque: "destructive",
    cancelado: "outline",
  };

export default function RomaneioDetalheDialog({ romaneioId, onClose }: Props) {
  const { data, isLoading } = useRomaneioDetalhe(romaneioId);
  const { obras } = useObrasContext();
  const { veiculos } = useVeiculosContext();
  const { data: insumos = [] } = useInsumosAtivosBasico();
  const cancelar = useCancelarRomaneio();
  const confirmarRomaneio = useConfirmarRomaneio();
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  const obraById = Object.fromEntries(obras.map((o) => [o.id, o.nome]));
  const veiculoById = Object.fromEntries(veiculos.map((v) => [v.id, v]));
  const insumoById = Object.fromEntries(insumos.map((i) => [i.id, i]));

  if (!romaneioId) return null;
  if (isLoading || !data) {
    return (
      <Dialog open onOpenChange={(v) => !v && onClose()}>
        <DialogContent>
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const { romaneio, itensEstoque, itensPatrimonio } = data;
  const status = romaneio.status as RomaneioStatus;
  const editavel = isRomaneioEditavel(status);

  function gerarPdf() {
    exportRomaneioToPDF({
      numero: romaneio.numero,
      status,
      obraOrigemNome: romaneio.obra_origem_id ? obraById[romaneio.obra_origem_id] : undefined,
      obraDestinoNome: obraById[romaneio.obra_destino_id] ?? "—",
      veiculoNome: romaneio.veiculo_transportador_id
        ? veiculoById[romaneio.veiculo_transportador_id]?.nome
        : undefined,
      dataProgramada: romaneio.data_programada,
      observacao: romaneio.observacao,
      criadoPorNome: romaneio.criado_por_nome,
      itensEstoque: itensEstoque.map((item) => ({
        insumoNome: insumoById[item.insumo_id]?.descricao ?? item.insumo_id,
        quantidade: item.quantidade,
        unidade: insumoById[item.insumo_id]?.unidade,
        localOrigem: obraById[item.local_origem] ?? item.local_origem,
        localDestino: obraById[item.local_destino] ?? item.local_destino,
      })),
      itensPatrimonio: itensPatrimonio.map((item) => ({
        codigo: item.patrimonio_codigo,
        nome: item.patrimonio_nome ?? item.patrimonio_id,
      })),
    });
  }

  async function handleConfirmar() {
    if (!romaneioId) return;
    await confirmarRomaneio.confirmar(romaneioId);
  }

  async function handleCancelar() {
    if (!romaneioId) return;
    await cancelar.mutateAsync(romaneioId);
    toast.success("Romaneio cancelado");
  }

  const semItens = itensEstoque.length === 0 && itensPatrimonio.length === 0;

  return (
    <>
      <Dialog open onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Romaneio {romaneio.numero}
              <Badge variant={STATUS_VARIANT[status]}>{ROMANEIO_STATUS_LABEL[status]}</Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Origem: </span>
              {romaneio.obra_origem_id ? obraById[romaneio.obra_origem_id] : "—"}
            </div>
            <div>
              <span className="text-muted-foreground">Destino: </span>
              {obraById[romaneio.obra_destino_id] ?? "—"}
            </div>
            <div>
              <span className="text-muted-foreground">Data programada: </span>
              {romaneio.data_programada ?? "—"}
            </div>
            <div>
              <span className="text-muted-foreground">Criado por: </span>
              {romaneio.criado_por_nome ?? "—"}
            </div>
            {romaneio.observacao && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Observação: </span>
                {romaneio.observacao}
              </div>
            )}
          </div>

          <RomaneioVeiculoField
            romaneioId={romaneioId}
            veiculoTransportadorId={romaneio.veiculo_transportador_id}
            mobilizarVeiculo={romaneio.mobilizar_veiculo}
            editavel={editavel}
          />
          {romaneio.veiculo_mobilizacao_erro && (
            <p className="text-xs text-destructive">
              Falha ao mobilizar veículo: {romaneio.veiculo_mobilizacao_erro}
            </p>
          )}

          <RomaneioItensEstoqueField
            romaneioId={romaneioId}
            itens={itensEstoque}
            editavel={editavel}
          />
          <RomaneioItensPatrimonioField
            romaneioId={romaneioId}
            itens={itensPatrimonio}
            obraOrigemId={romaneio.obra_origem_id}
            editavel={editavel}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={gerarPdf} className="gap-2">
              <FileDown className="h-4 w-4" />
              Gerar PDF
            </Button>
            {editavel && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelar}
                disabled={cancelar.isPending}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Cancelar romaneio
              </Button>
            )}
            {editavel && (
              <Button size="sm" onClick={() => setConfirmDialogOpen(true)} disabled={semItens}>
                Confirmar
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <RomaneioConfirmarDialog
        open={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
        onConfirm={handleConfirmar}
        loading={confirmarRomaneio.loading}
        error={confirmarRomaneio.error}
        progress={confirmarRomaneio.progress}
        failures={confirmarRomaneio.failures}
      />
    </>
  );
}
