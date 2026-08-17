import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import DatePickerField from "@/components/common/DatePickerField";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { rotuloStatus } from "@/lib/rh/statusHistorico";
import type { Colaborador, PeriodoAlocacao } from "@/types";
import { fmtDataLocal } from "@/lib/core/date";
import { logger } from "@/lib/core/logger";

export interface ExportMovimentacoesDialogProps {
  open: boolean;
  onClose: () => void;
  colaboradores: Colaborador[];
}

const ExportMovimentacoesDialog: React.FC<ExportMovimentacoesDialogProps> = ({
  open,
  onClose,
  colaboradores,
}) => {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    if (!from || !to) return;
    setLoading(true);
    try {
      // Fonte: rota `mobilizacoesPeriodos` (MySQL). Antes esta consulta ia ao
      // Supabase, onde `mobilizacoes_periodos` não recebe escrita há tempos —
      // todas as mobilizações são gravadas no MySQL. A exportação vinha vazia
      // ou desatualizada sem avisar ninguém.
      const data = await api.getAll<PeriodoAlocacao>("mobilizacoesPeriodos", { from, to });

      const colabById = new Map(colaboradores.map((c) => [c.id, c]));
      const rows = (Array.isArray(data) ? data : [])
        .slice()
        .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio))
        .map((r) => {
          const c = colabById.get(String(r.colaborador_id));
          return {
            Matrícula: r.colaborador_matricula || c?.matricula || "",
            Nome: r.colaborador_nome || c?.nome || "",
            Função: r.colaborador_funcao || c?.funcao || "",
            De: r.from_obra_nome || "",
            // Períodos de status não têm obra de destino: o "para" é o status.
            Para: r.obra_nome || (r.status ? rotuloStatus(r.status).label : ""),
            "Data do movimento": r.registrado_em ? fmtDataLocal(r.registrado_em) : "",
            "Data de mobilização": r.data_inicio
              ? fmtDataLocal(r.data_inicio + "T00:00:00")
              : "",
            Tipo: r.tipo === "status" ? "status" : "mobilizacao",
            Usuário: r.usuario_nome || "",
          };
        });

      if (rows.length === 0) {
        rows.push({
          Matrícula: "",
          Nome: "Nenhuma movimentação no período",
          Função: "",
          De: "",
          Para: "",
          "Data do movimento": "",
          "Data de mobilização": "",
          Tipo: "",
          Usuário: "",
        });
      }

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Movimentações");
      XLSX.writeFile(wb, `movimentacoes_${from}_a_${to}.xlsx`);
      onClose();
    } catch (err) {
      logger.error("Erro ao exportar movimentações:", err);
      toast.error("Falha ao gerar a exportação. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !loading && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">Exportar movimentações</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Data início</Label>
            <DatePickerField value={from} onChange={setFrom} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Data fim</Label>
            <DatePickerField value={to} onChange={setTo} className="mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleExport} disabled={!from || !to || loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Gerando…
              </>
            ) : (
              "Exportar XLS"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExportMovimentacoesDialog;
