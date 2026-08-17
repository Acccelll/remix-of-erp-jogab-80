// Barra de fechamento de competência do ponto.
//
// Fechar congela a base: a importação (CSV ou RHiD, inclusive o cron) passa a
// recusar o período. É o passo que falta hoje — dá para re-sincronizar um mês
// já pago e mudar a base de uma folha fechada sem registro de que mudou.
import { useState } from "react";
import { Lock, LockOpen, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth/useAuth";
import { usePermissions } from "@/contexts/auth/usePermissions";
import { useFechamentoPonto } from "@/hooks/dp/useFechamentoPonto";
import { competenciaValida, fechamentoAtivo } from "@/lib/dp/fechamento-competencia";
import { fmtData } from "@/lib/core/date";

interface Props {
  /** Período em foco no hub — define a competência sugerida. */
  inicio: string;
  fim: string;
}

export default function PontoFechamentoBar({ inicio, fim }: Props) {
  const { currentPlayer } = useAuth();
  const { isGM } = usePermissions();
  const { fechamentos, fechar, reabrir, travaDoPeriodo } = useFechamentoPonto();

  const competencia = fim.slice(0, 7);
  const ativo = competenciaValida(competencia) ? fechamentoAtivo(fechamentos, competencia) : null;
  const trava = travaDoPeriodo(inicio, fim);

  const [dlgFechar, setDlgFechar] = useState(false);
  const [dlgReabrir, setDlgReabrir] = useState(false);
  const [responsavel, setResponsavel] = useState(currentPlayer?.login ?? "");
  const [motivo, setMotivo] = useState("");

  if (!competenciaValida(competencia)) return null;

  const confirmarFechar = () => {
    fechar.mutate(
      { competencia, fechadoPor: responsavel.trim(), motivo: motivo.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(`Competência ${competencia} fechada para ponto.`);
          setDlgFechar(false);
          setMotivo("");
        },
        onError: (e: unknown) =>
          toast.error("Falha ao fechar: " + (e instanceof Error ? e.message : String(e))),
      },
    );
  };

  const confirmarReabrir = () => {
    reabrir.mutate(
      { competencia, reabertoPor: responsavel.trim(), motivoReabertura: motivo.trim() },
      {
        onSuccess: () => {
          toast.success(`Competência ${competencia} reaberta.`);
          setDlgReabrir(false);
          setMotivo("");
        },
        onError: (e: unknown) =>
          toast.error("Falha ao reabrir: " + (e instanceof Error ? e.message : String(e))),
      },
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border px-3 py-2">
      {ativo ? (
        <>
          <Badge variant="destructive" className="gap-1">
            <Lock className="w-3 h-3" /> {competencia} fechada
          </Badge>
          <span className="text-xs text-muted-foreground">
            por {ativo.fechadoPor} em {fmtData(ativo.fechadoEm)}
            {ativo.motivo ? ` · ${ativo.motivo}` : ""}
          </span>
        </>
      ) : (
        <>
          <Badge variant="secondary" className="gap-1">
            <LockOpen className="w-3 h-3" /> {competencia} aberta
          </Badge>
          <span className="text-xs text-muted-foreground">
            Importações e sincronizações do período são aceitas.
          </span>
        </>
      )}

      {/* O período do hub pode atravessar meses: avisa qual competência trava. */}
      {!trava.ok && !ativo && <span className="text-xs text-destructive">{trava.motivo}</span>}

      <div className="ml-auto">
        {isGM ? (
          ativo ? (
            <Button variant="outline" size="sm" onClick={() => setDlgReabrir(true)}>
              <LockOpen className="w-4 h-4 mr-1" /> Reabrir
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setDlgFechar(true)}>
              <ShieldCheck className="w-4 h-4 mr-1" /> Fechar competência
            </Button>
          )
        ) : (
          <span className="text-xs text-muted-foreground">Fechamento restrito a GM</span>
        )}
      </div>

      <Dialog open={dlgFechar} onOpenChange={setDlgFechar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fechar {competencia} para ponto</DialogTitle>
            <DialogDescription>
              A partir daqui, nenhuma importação ou sincronização grava neste mês — nem a
              automática. Reabrir exige motivo e fica registrado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="fech-resp">Responsável</Label>
              <Input
                id="fech-resp"
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="fech-motivo">Observação (opcional)</Label>
              <Textarea
                id="fech-motivo"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlgFechar(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmarFechar} disabled={fechar.isPending || !responsavel.trim()}>
              Fechar competência
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dlgReabrir} onOpenChange={setDlgReabrir}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reabrir {competencia}</DialogTitle>
            <DialogDescription>
              A base do ponto volta a aceitar carga — e pode divergir de uma folha já paga. O motivo
              é obrigatório e fica no histórico.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="reab-resp">Responsável</Label>
              <Input
                id="reab-resp"
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="reab-motivo">Motivo da reabertura</Label>
              <Textarea
                id="reab-motivo"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlgReabrir(false)}>
              Cancelar
            </Button>
            <Button
              onClick={confirmarReabrir}
              disabled={reabrir.isPending || !responsavel.trim() || !motivo.trim()}
            >
              Reabrir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
