import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { brl } from "@/lib/billing";
import {
  estornarBaixaCanonica,
  type MovimentoTituloRow,
} from "@/lib/repositories/financeiro-titulos-operacoes";

interface EstornarBaixaDialogProps {
  movimento: MovimentoTituloRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void | Promise<void>;
}

function hojeLocal(): string {
  const agora = new Date();
  const offset = agora.getTimezoneOffset() * 60_000;
  return new Date(agora.getTime() - offset).toISOString().slice(0, 10);
}

export function EstornarBaixaDialog({
  movimento,
  open,
  onOpenChange,
  onSuccess,
}: EstornarBaixaDialogProps) {
  const [dataEstorno, setDataEstorno] = useState(hojeLocal());
  const [observacao, setObservacao] = useState("");

  useEffect(() => {
    if (!open) return;
    setDataEstorno(hojeLocal());
    setObservacao("");
  }, [open, movimento?.id]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!movimento) throw new Error("Baixa não selecionada.");
      await estornarBaixaCanonica({
        baixa_id: movimento.id,
        data_estorno: dataEstorno,
        observacao: observacao.trim() || null,
      });
    },
    onSuccess: async () => {
      toast.success("Baixa estornada. O movimento original foi preservado no histórico.");
      await onSuccess();
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!movimento) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Estornar baixa</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/25 p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Valor principal</span>
              <span className="font-semibold tabular-nums">{brl(movimento.valor_principal)}</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              O registro original não será alterado nem excluído. O estorno será incluído como um novo movimento reverso no ledger.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="data-estorno">Data do estorno</Label>
            <Input id="data-estorno" type="date" value={dataEstorno} onChange={(event) => setDataEstorno(event.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="observacao-estorno">Motivo / observação</Label>
            <Textarea
              id="observacao-estorno"
              value={observacao}
              onChange={(event) => setObservacao(event.target.value)}
              rows={3}
              placeholder="Ex.: pagamento lançado em duplicidade"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Voltar</Button>
          <Button
            variant="destructive"
            disabled={!dataEstorno || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
            Confirmar estorno
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EstornarBaixaDialog;
