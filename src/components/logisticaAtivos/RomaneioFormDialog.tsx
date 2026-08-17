import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus } from "lucide-react";
import { useObrasContext } from "@/contexts/ObrasContext";
import { useCreateRomaneio } from "@/hooks/logisticaAtivos/useRomaneios";
import { validarNovoRomaneio } from "@/lib/logisticaAtivos/status";

interface Props {
  criadoPorNome?: string | null;
  onCreated: (romaneioId: string) => void;
}

export default function RomaneioFormDialog({ criadoPorNome, onCreated }: Props) {
  const { obras } = useObrasContext();
  const createRomaneio = useCreateRomaneio();
  const [open, setOpen] = useState(false);
  const [obraOrigemId, setObraOrigemId] = useState("");
  const [obraDestinoId, setObraDestinoId] = useState("");
  const [dataProgramada, setDataProgramada] = useState("");
  const [observacao, setObservacao] = useState("");

  const activeObras = obras.filter((o) => o.ativa);

  function reset() {
    setObraOrigemId("");
    setObraDestinoId("");
    setDataProgramada("");
    setObservacao("");
  }

  async function submit() {
    const erros = validarNovoRomaneio({
      obraOrigemId: obraOrigemId || null,
      obraDestinoId: obraDestinoId || null,
      // Itens são adicionados depois de criado o rascunho — a validação aqui
      // cobre apenas o par obra origem/destino.
      itensEstoqueCount: 1,
      itensPatrimonioCount: 1,
    });
    if (erros.length > 0) {
      toast.error(erros[0]);
      return;
    }
    try {
      const id = await createRomaneio.mutateAsync({
        obraOrigemId: obraOrigemId || null,
        obraDestinoId,
        dataProgramada: dataProgramada || null,
        observacao: observacao || null,
        criadoPorNome: criadoPorNome ?? null,
      });
      reset();
      setOpen(false);
      onCreated(id);
    } catch {
      /* toast de erro já emitido por useCreateRomaneio */
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Novo romaneio
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo romaneio</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Obra origem</Label>
              <Select value={obraOrigemId} onValueChange={setObraOrigemId}>
                <SelectTrigger>
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  {activeObras.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Obra destino</Label>
              <Select value={obraDestinoId} onValueChange={setObraDestinoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Obrigatório" />
                </SelectTrigger>
                <SelectContent>
                  {activeObras.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Data programada</Label>
            <Input
              type="date"
              value={dataProgramada}
              onChange={(e) => setDataProgramada(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Observação</Label>
            <Textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={2}
              placeholder="Opcional"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={createRomaneio.isPending}
          >
            Cancelar
          </Button>
          <Button onClick={submit} disabled={createRomaneio.isPending} className="gap-2">
            {createRomaneio.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Criar rascunho
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
