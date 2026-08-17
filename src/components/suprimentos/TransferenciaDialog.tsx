import { useState } from "react";
import { suprimentosRepo } from "@/lib/repositories/suprimentos";
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
import { ArrowRightLeft, Loader2 } from "lucide-react";

interface Props {
  insumos: { id: string; codigo: string | null; descricao: string }[];
  obras: { id: string; nome: string }[];
  onDone: () => void;
}

export default function TransferenciaDialog({ insumos, obras, onDone }: Props) {
  const [open, setOpen] = useState(false);
  const [insumoId, setInsumoId] = useState("");
  const [origem, setOrigem] = useState("");
  const [destino, setDestino] = useState("");
  const [qtd, setQtd] = useState("");
  const [obs, setObs] = useState("");
  const [loading, setLoading] = useState(false);

  function reset() {
    setInsumoId("");
    setOrigem("");
    setDestino("");
    setQtd("");
    setObs("");
  }

  async function submit() {
    const quantidade = Number(qtd);
    if (!insumoId || !origem || !destino) {
      toast.error("Preencha insumo, origem e destino");
      return;
    }
    if (origem === destino) {
      toast.error("Origem e destino devem ser diferentes");
      return;
    }
    if (!(quantidade > 0)) {
      toast.error("Quantidade deve ser maior que zero");
      return;
    }
    setLoading(true);
    try {
      await suprimentosRepo.transferirEstoque({
        insumo: insumoId,
        origem,
        destino,
        quantidade,
        observacao: obs || undefined,
      });
    } catch (e: any) {
      setLoading(false);
      toast.error(e?.message ?? "Falha");
      return;
    }
    setLoading(false);
    toast.success("Transferência registrada");
    reset();
    setOpen(false);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <ArrowRightLeft className="h-4 w-4" />
          Transferir
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transferir estoque entre locais</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Insumo</Label>
            <Select value={insumoId} onValueChange={setInsumoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o insumo" />
              </SelectTrigger>
              <SelectContent>
                {insumos.slice(0, 300).map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.codigo ? `${i.codigo} — ` : ""}
                    {i.descricao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Origem</Label>
              <Select value={origem} onValueChange={setOrigem}>
                <SelectTrigger>
                  <SelectValue placeholder="Local origem" />
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
            <div>
              <Label className="text-xs">Destino</Label>
              <Select value={destino} onValueChange={setDestino}>
                <SelectTrigger>
                  <SelectValue placeholder="Local destino" />
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
          <div>
            <Label className="text-xs">Quantidade</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={qtd}
              onChange={(e) => setQtd(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Observação</Label>
            <Textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              rows={2}
              placeholder="Opcional"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={loading} className="gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Transferir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
