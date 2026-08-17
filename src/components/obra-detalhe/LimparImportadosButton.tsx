import { useState } from "react";
import { AlertCircle, Trash2 } from "lucide-react";
import { limparCronogramaCompletoByObra } from "@/hooks/obras/useCronograma";
import {
  medicoesRepo,
  itensMedicaoRepo,
  notasFiscaisRepo,
  recebimentosRepo,
} from "@/lib/repositories/medicoes";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useObraPermissions } from "@/components/obra/ObraPermissionsContext";

export function LimparImportadosButton({
  obraId,
  temMedicoes,
  temNfs,
  temRecebimentos,
  onDone,
  asMenuItem = false,
}: {
  obraId: string;
  temMedicoes: boolean;
  temNfs: boolean;
  temRecebimentos: boolean;
  onDone: () => void;
  asMenuItem?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [incluirFaturamento, setIncluirFaturamento] = useState(false);
  const { canManage } = useObraPermissions();

  if (!canManage) return null;

  const temFinanceiro = temMedicoes || temNfs || temRecebimentos;
  const bloqueado = temFinanceiro && !incluirFaturamento;
  const podeExecutar = confirmText.trim().toUpperCase() === "LIMPAR" && !bloqueado;

  async function limpar() {
    if (!podeExecutar) return;
    setLoading(true);
    try {
      if (incluirFaturamento) {
        // 0a) Itens de medição → medições → NFs → todos recebimentos
        const medIds = await medicoesRepo.listIdsByObra(obraId);
        if (medIds.length) {
          await itensMedicaoRepo.removeByMedicaoIds(medIds);
        }
        // Recebimentos antes das NFs (têm FK lógica nota_fiscal_id)
        await recebimentosRepo.removeByObra(obraId);
        await notasFiscaisRepo.removeByObra(obraId);
        if (medIds.length) {
          await medicoesRepo.removeMany(medIds);
        }
      } else {
        // 1) Previsões de recebimento (não efetivadas) — derivadas do cronograma
        await recebimentosRepo.removePrevistasByObra(obraId);
      }

      // 2-4) Cronograma completo (revisões + baselines + dependências + itens)
      await limparCronogramaCompletoByObra(obraId);

      toast.success(
        incluirFaturamento
          ? "Cronograma e faturamento removidos. Você pode reimportar do zero."
          : "Dados importados removidos. Você pode reimportar o XML.",
      );
      setOpen(false);
      setConfirmText("");
      setIncluirFaturamento(false);
      onDone();
    } catch (e: any) {
      toast.error("Falha ao limpar: " + (e?.message ?? "erro desconhecido"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setConfirmText("");
      }}
    >
      {asMenuItem ? (
        <DropdownMenuItem
          className="text-destructive focus:text-destructive focus:bg-destructive/10"
          onSelect={(e) => {
            e.preventDefault();
            setOpen(true);
          }}
        >
          <Trash2 className="h-4 w-4 mr-2" /> Limpar importados
        </DropdownMenuItem>
      ) : (
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-1" /> Limpar importados
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Limpar dados importados de contrato e revisões
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-destructive">
            <p className="font-medium">Esta ação é irreversível.</p>
            <p className="mt-1">Serão removidos permanentemente desta obra:</p>
            <ul className="list-disc ml-5 mt-1 space-y-0.5">
              <li>Todos os itens do cronograma (incluindo baseline e CPM)</li>
              <li>Todas as revisões importadas e seu histórico de mudanças</li>
              <li>Baselines congelados e dependências entre tarefas</li>
              <li>Previsões de recebimento ainda não efetivadas</li>
            </ul>
          </div>

          <div className="rounded-md border border-border bg-muted/30 p-3 text-muted-foreground">
            <p className="font-medium text-foreground">Não serão alterados:</p>
            <p>Contrato, aditivos e logs de auditoria.</p>
          </div>

          {temFinanceiro && (
            <div
              className={`rounded-md border p-3 ${incluirFaturamento ? "border-destructive/40 bg-destructive/5 text-destructive" : "border-warning/40 bg-warning/10 text-warning"}`}
            >
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={incluirFaturamento}
                  onChange={(e) => setIncluirFaturamento(e.target.checked)}
                  className="mt-1"
                  disabled={loading}
                />
                <div className="text-sm">
                  <p className="font-medium">
                    Também remover medições, notas fiscais e recebimentos
                  </p>
                  <p className="mt-1">
                    Esta obra possui registros financeiros:
                    {temMedicoes && <span className="block">• medições</span>}
                    {temNfs && <span className="block">• notas fiscais</span>}
                    {temRecebimentos && <span className="block">• recebimentos já efetivados</span>}
                  </p>
                  <p className="mt-1">
                    {incluirFaturamento
                      ? "Tudo será apagado em cascata — inclusive valores já recebidos."
                      : "Marque para apagar tudo em cascata, ou cancele para preservar o histórico financeiro."}
                  </p>
                </div>
              </label>
            </div>
          )}

          <div>
            <Label htmlFor="confirm-limpar" className="text-xs">
              Para confirmar, digite <span className="font-mono font-semibold">LIMPAR</span>:
            </Label>
            <Input
              id="confirm-limpar"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="LIMPAR"
              disabled={bloqueado || loading}
              className="mt-1"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={limpar} disabled={!podeExecutar || loading}>
            {loading ? "Limpando…" : "Limpar definitivamente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
