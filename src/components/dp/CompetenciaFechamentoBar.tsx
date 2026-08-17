// PRO-003 · slice-02 — Barra de fechamento de competência (Fopag).
import { useState } from "react";
import { Lock, Unlock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth/useAuth";
import { useDpFechamentoCompetenciaMerged } from "@/hooks/dp/useDpFechamentoCompetenciaRemoto";
import { useDpFechamentoReconciliacao } from "@/hooks/dp/useDpFechamentoReconciliacao";
import { competenciaValida } from "@/lib/dp/fechamento-competencia";

type Props = {
  competencia: string; // YYYY-MM
};

export default function CompetenciaFechamentoBar({ competencia }: Props) {
  const { currentPlayer } = useAuth();
  const { hydrated, ativo, fechar, reabrir } = useDpFechamentoCompetenciaMerged();
  useDpFechamentoReconciliacao();
  const [dlgFechar, setDlgFechar] = useState(false);
  const [dlgReabrir, setDlgReabrir] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [responsavel, setResponsavel] = useState("");

  if (!hydrated) return null;
  if (!competencia || !competenciaValida(competencia)) {
    return (
      <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Selecione uma competência (YYYY-MM) para gerenciar o fechamento.
      </div>
    );
  }

  const fech = ativo(competencia);
  const nomePadrao = currentPlayer?.login ?? "sistema";

  const onFechar = async () => {
    try {
      await fechar(competencia, responsavel.trim() || nomePadrao, motivo.trim() || undefined);
      toast.success(`Competência ${competencia} fechada.`);
      setDlgFechar(false);
      setMotivo("");
      setResponsavel("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao fechar");
    }
  };

  const onReabrir = async () => {
    try {
      await reabrir(competencia, responsavel.trim() || nomePadrao, motivo.trim());
      toast.success(`Competência ${competencia} reaberta.`);
      setDlgReabrir(false);
      setMotivo("");
      setResponsavel("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao reabrir");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border px-3 py-2">
      <ShieldCheck className="h-4 w-4 text-primary" />
      <span className="text-sm">
        Competência <span className="font-mono">{competencia}</span>:
      </span>
      {fech ? (
        <>
          <Badge variant="default" className="gap-1">
            <Lock className="h-3 w-3" /> Fechada
          </Badge>
          <span className="text-xs text-muted-foreground">
            {fech.fechadoEm.slice(0, 10)} por {fech.fechadoPor}
            {fech.motivo ? ` · ${fech.motivo}` : ""}
          </span>
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => setDlgReabrir(true)}>
            <Unlock className="h-4 w-4 mr-1" /> Reabrir
          </Button>
        </>
      ) : (
        <>
          <Badge variant="secondary">Aberta</Badge>
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => setDlgFechar(true)}>
            <Lock className="h-4 w-4 mr-1" /> Fechar competência
          </Button>
        </>
      )}

      <Dialog open={dlgFechar} onOpenChange={setDlgFechar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fechar competência {competencia}</DialogTitle>
            <DialogDescription>
              Após o fechamento, lançamentos desta competência ficam travados até reabertura formal.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Responsável</Label>
              <Input
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
                placeholder={nomePadrao}
              />
            </div>
            <div>
              <Label className="text-xs">Motivo (opcional)</Label>
              <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlgFechar(false)}>
              Cancelar
            </Button>
            <Button onClick={onFechar}>Fechar competência</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dlgReabrir} onOpenChange={setDlgReabrir}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reabrir competência {competencia}</DialogTitle>
            <DialogDescription>
              Reabertura fica registrada com motivo obrigatório para auditoria.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Responsável</Label>
              <Input
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
                placeholder={nomePadrao}
              />
            </div>
            <div>
              <Label className="text-xs">Motivo *</Label>
              <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlgReabrir(false)}>
              Cancelar
            </Button>
            <Button onClick={onReabrir} disabled={!motivo.trim()}>
              Reabrir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
