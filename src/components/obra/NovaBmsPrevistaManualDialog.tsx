// Dialog para criar BMS prevista manual (origem='manual').
// O modo de edição existente (datas) já está dentro de FinObraDetalhe;
// este componente é dedicado à inclusão manual com valor variável.
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { bmsPrevistasRepo } from "@/lib/repositories/obraDetalhe";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function NovaBmsPrevistaManualDialog({
  obraId,
  proximoNumero,
  onCreated,
}: {
  obraId: string;
  proximoNumero: number;
  onCreated?: () => void;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    numero: String(proximoNumero),
    data_inicio_janela: "",
    data_corte: "",
    valor_previsto_inicial: "",
    data_emissao_nfs_prevista: "",
    data_pagamento_prevista: "",
    observacoes: "",
  });

  async function salvar() {
    if (!form.data_corte) return toast.error("Informe a data de corte.");
    if (!form.valor_previsto_inicial) return toast.error("Informe o valor previsto.");
    const num = Number(form.valor_previsto_inicial.replace(",", "."));
    if (!Number.isFinite(num) || num <= 0) return toast.error("Valor inválido.");

    setSaving(true);
    let error: any = null;
    try {
      await bmsPrevistasRepo.insertManual({
        obra_id: obraId,
        numero: Number(form.numero),
        data_inicio_janela: form.data_inicio_janela || form.data_corte,
        data_corte: form.data_corte,
        valor_previsto_inicial: num,
        valor_previsto_dinamico: num,
        data_emissao_nfs_prevista: form.data_emissao_nfs_prevista || null,
        data_pagamento_prevista: form.data_pagamento_prevista || null,
        observacoes: form.observacoes || null,
        status: "prevista",
        origem: "manual",
        editado_em: new Date().toISOString(),
      });
    } catch (e: any) {
      error = e;
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("BMS prevista manual criada.");
    qc.invalidateQueries({ queryKey: ["bms_previstas"] });
    onCreated?.();
    setOpen(false);
    setForm((f) => ({
      ...f,
      numero: String(Number(f.numero) + 1),
      valor_previsto_inicial: "",
      observacoes: "",
    }));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="h-4 w-4 mr-2" />
          Nova BMS manual
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova BMS prevista (manual)</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Número</Label>
              <Input
                type="number"
                value={form.numero}
                onChange={(e) => setForm({ ...form, numero: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Valor previsto (R$)</Label>
              <Input
                value={form.valor_previsto_inicial}
                onChange={(e) => setForm({ ...form, valor_previsto_inicial: e.target.value })}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Início da janela</Label>
              <Input
                type="date"
                value={form.data_inicio_janela}
                onChange={(e) => setForm({ ...form, data_inicio_janela: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data de corte</Label>
              <Input
                type="date"
                value={form.data_corte}
                onChange={(e) => setForm({ ...form, data_corte: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Emissão NFS prevista</Label>
              <Input
                type="date"
                value={form.data_emissao_nfs_prevista}
                onChange={(e) => setForm({ ...form, data_emissao_nfs_prevista: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Pagamento previsto</Label>
              <Input
                type="date"
                value={form.data_pagamento_prevista}
                onChange={(e) => setForm({ ...form, data_pagamento_prevista: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              rows={2}
            />
          </div>
          <div className="text-xs text-muted-foreground">
            Linhas manuais não são reescritas pelo recálculo automático da régua. Use para incluir
            parcelas excepcionais (mobilização extra, aditivos pontuais).
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando…
                </>
              ) : (
                "Salvar"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
