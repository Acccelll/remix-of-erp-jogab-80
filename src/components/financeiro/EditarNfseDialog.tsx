// Edição direta de um lançamento de NFS-e no módulo Faturamento.
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { notasFiscaisRepo } from "@/lib/repositories/medicoes";

export type NfseEditavel = {
  id: string;
  numero_nfse: string;
  data_emissao: string | null;
  competencia: string | null;
  tomador_razao: string | null;
  tomador_uf: string | null;
  obra_id: string | null;
  numero_bms: string | null;
  pedido: string | null;
  valor_servicos: number;
  valor_iss: number;
  valor_inss: number;
  valor_liquido: number;
  data_vencimento: string | null;
  discriminacao: string | null;
};

const SEM_OBRA = "__sem_obra__";

export function EditarNfseDialog({
  nfse,
  obras,
  onClose,
  onSaved,
}: {
  nfse: NfseEditavel | null;
  obras: Array<{ id: string; nome: string | null; codigo: string | null }>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState<NfseEditavel | null>(nfse);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => setF(nfse), [nfse]);

  const set = (k: keyof NfseEditavel, v: unknown) =>
    setF((prev) => (prev ? ({ ...prev, [k]: v } as NfseEditavel) : prev));

  const num = (v: unknown) => {
    const n = Number(String(v ?? "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };

  async function salvar() {
    if (!f) return;
    if (!String(f.numero_nfse ?? "").trim()) {
      toast.error("Informe o número da NFS-e.");
      return;
    }
    setSalvando(true);
    try {
      await notasFiscaisRepo.updateFaturamentoNfse(f.id, {
        numero_nfse: String(f.numero_nfse).trim(),
        data_emissao: f.data_emissao || null,
        competencia: f.competencia || null,
        tomador_razao: f.tomador_razao || null,
        tomador_uf: f.tomador_uf || null,
        obra_id: f.obra_id || null,
        numero_bms: f.numero_bms || null,
        pedido: f.pedido || null,
        valor_servicos: num(f.valor_servicos),
        valor_iss: num(f.valor_iss),
        valor_inss: num(f.valor_inss),
        valor_liquido: num(f.valor_liquido),
        data_vencimento: f.data_vencimento || null,
        ...(f.data_vencimento ? { vencimento_origem: "manual" } : {}),
        discriminacao: f.discriminacao || null,
      });
      toast.success("Lançamento atualizado.");
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao salvar o lançamento.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={!!f} onOpenChange={(o) => !o && !salvando && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar NFS-e {f?.numero_nfse}</DialogTitle>
          <DialogDescription>
            As alterações refletem também no Faturamento da obra vinculada.
          </DialogDescription>
        </DialogHeader>
        {f && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Número</Label>
              <Input
                value={f.numero_nfse ?? ""}
                onChange={(e) => set("numero_nfse", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Obra</Label>
              <Select
                value={f.obra_id ?? SEM_OBRA}
                onValueChange={(v) => set("obra_id", v === SEM_OBRA ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_OBRA}>Sem vínculo</SelectItem>
                  {obras.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.nome ?? o.codigo ?? o.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Emissão</Label>
              <Input
                type="date"
                value={f.data_emissao ?? ""}
                onChange={(e) => set("data_emissao", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Vencimento</Label>
              <Input
                type="date"
                value={f.data_vencimento ?? ""}
                onChange={(e) => set("data_vencimento", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Tomador</Label>
              <Input
                value={f.tomador_razao ?? ""}
                onChange={(e) => set("tomador_razao", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>UF</Label>
              <Input
                maxLength={2}
                value={f.tomador_uf ?? ""}
                onChange={(e) => set("tomador_uf", e.target.value.toUpperCase())}
              />
            </div>
            <div className="space-y-1">
              <Label>BMS</Label>
              <Input
                value={f.numero_bms ?? ""}
                onChange={(e) => set("numero_bms", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Pedido</Label>
              <Input value={f.pedido ?? ""} onChange={(e) => set("pedido", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Valor serviços</Label>
              <Input
                type="number"
                step="0.01"
                value={f.valor_servicos ?? 0}
                onChange={(e) => set("valor_servicos", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Valor líquido</Label>
              <Input
                type="number"
                step="0.01"
                value={f.valor_liquido ?? 0}
                onChange={(e) => set("valor_liquido", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>ISS</Label>
              <Input
                type="number"
                step="0.01"
                value={f.valor_iss ?? 0}
                onChange={(e) => set("valor_iss", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>INSS</Label>
              <Input
                type="number"
                step="0.01"
                value={f.valor_inss ?? 0}
                onChange={(e) => set("valor_inss", e.target.value)}
              />
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Discriminação</Label>
              <Input
                value={f.discriminacao ?? ""}
                onChange={(e) => set("discriminacao", e.target.value)}
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
