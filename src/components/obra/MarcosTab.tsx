import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { Plus, Trash2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cronogramaMarcosRepo } from "@/lib/repositories/obraDetalhe";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type Marco = {
  id: string;
  obra_id: string;
  nome: string;
  data_prevista: string;
  data_baseline: string | null;
  data_realizado: string | null;
  tipo: string;
  critico: boolean;
  observacoes: string | null;
  ordem: number;
};

export function useMarcos(obraId: string) {
  return useQuery({
    queryKey: ["marcos", obraId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cronograma_marcos")
        .select(
          "id, obra_id, nome, data_prevista, data_baseline, data_realizado, tipo, critico, observacoes, ordem",
        )
        .eq("obra_id", obraId)
        .order("data_prevista")
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Marco[];
    },
  });
}

export function MarcosTab({ obraId }: { obraId: string }) {
  const qc = useQueryClient();
  const { data: marcos } = useMarcos(obraId);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Marco | null>(null);
  const [form, setForm] = useState<Partial<Marco>>({});

  function startNew() {
    setEditing(null);
    setForm({ tipo: "marco", critico: false, ordem: (marcos?.length ?? 0) + 1 });
    setOpen(true);
  }
  function startEdit(m: Marco) {
    setEditing(m);
    setForm(m);
    setOpen(true);
  }

  async function save() {
    if (!form.nome || !form.data_prevista) {
      toast.error("Nome e data prevista são obrigatórios.");
      return;
    }
    const payload: any = {
      obra_id: obraId,
      nome: form.nome,
      data_prevista: form.data_prevista,
      data_baseline: form.data_baseline || null,
      data_realizado: form.data_realizado || null,
      tipo: form.tipo ?? "marco",
      critico: !!form.critico,
      observacoes: form.observacoes ?? null,
      ordem: Number(form.ordem ?? 0),
    };
    try {
      await cronogramaMarcosRepo.upsert(editing?.id, payload);
    } catch (error: any) {
      return toast.error(error.message);
    }
    toast.success(editing ? "Marco atualizado" : "Marco criado");
    qc.invalidateQueries({ queryKey: ["marcos", obraId] });
    setOpen(false);
  }

  async function remove(id: string) {
    try {
      await cronogramaMarcosRepo.remove(id);
    } catch (error: any) {
      return toast.error(error.message);
    }
    qc.invalidateQueries({ queryKey: ["marcos", obraId] });
  }

  async function marcarRealizado(m: Marco) {
    const hoje = format(new Date(), "yyyy-MM-dd");
    try {
      await cronogramaMarcosRepo.updateRealizado(m.id, m.data_realizado ? null : hoje);
    } catch (error: any) {
      return toast.error(error.message);
    }
    qc.invalidateQueries({ queryKey: ["marcos", obraId] });
  }

  const hoje = new Date();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Marcos</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={startNew}>
              <Plus className="h-4 w-4 mr-1" /> Novo marco
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar marco" : "Novo marco"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div>
                <Label>Nome</Label>
                <Input
                  value={form.nome ?? ""}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Tipo</Label>
                  <Select
                    value={form.tipo ?? "marco"}
                    onValueChange={(v) => setForm({ ...form, tipo: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="marco">Marco</SelectItem>
                      <SelectItem value="entrega">Entrega</SelectItem>
                      <SelectItem value="contratual">Contratual</SelectItem>
                      <SelectItem value="pagamento">Pagamento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Ordem</Label>
                  <Input
                    type="number"
                    value={form.ordem ?? 0}
                    onChange={(e) => setForm({ ...form, ordem: Number(e.target.value) })}
                  />
                </div>
                <div className="flex items-end gap-2 pb-1">
                  <Switch
                    checked={!!form.critico}
                    onCheckedChange={(v) => setForm({ ...form, critico: v })}
                  />
                  <Label>Crítico</Label>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Prevista</Label>
                  <Input
                    type="date"
                    value={form.data_prevista ?? ""}
                    onChange={(e) => setForm({ ...form, data_prevista: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Baseline</Label>
                  <Input
                    type="date"
                    value={form.data_baseline ?? ""}
                    onChange={(e) => setForm({ ...form, data_baseline: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Realizado</Label>
                  <Input
                    type="date"
                    value={form.data_realizado ?? ""}
                    onChange={(e) => setForm({ ...form, data_realizado: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea
                  rows={2}
                  value={form.observacoes ?? ""}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={save}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {(marcos ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum marco cadastrado.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Baseline</TableHead>
                <TableHead>Prevista</TableHead>
                <TableHead>Desvio</TableHead>
                <TableHead>Realizado</TableHead>
                <TableHead className="w-32">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(marcos ?? []).map((m) => {
                const desvioBase = m.data_baseline
                  ? differenceInCalendarDays(parseISO(m.data_prevista), parseISO(m.data_baseline))
                  : null;
                const atrasado = !m.data_realizado && parseISO(m.data_prevista) < hoje;
                return (
                  <TableRow key={m.id} className="cursor-pointer" onClick={() => startEdit(m)}>
                    <TableCell className="font-medium">
                      {m.nome}
                      {m.critico && (
                        <Badge variant="destructive" className="ml-2 text-[10px] px-1 py-0">
                          crítico
                        </Badge>
                      )}
                      {atrasado && (
                        <Badge
                          variant="secondary"
                          className="ml-2 bg-destructive/15 text-destructive dark:bg-destructive/30 dark:text-destructive text-[10px] px-1 py-0"
                        >
                          atrasado
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="capitalize text-xs">{m.tipo}</TableCell>
                    <TableCell className="text-xs">{m.data_baseline ?? "—"}</TableCell>
                    <TableCell className="text-xs">{m.data_prevista}</TableCell>
                    <TableCell
                      className={`text-xs tabular-nums ${desvioBase != null && desvioBase > 0 ? "text-destructive" : desvioBase != null && desvioBase < 0 ? "text-success" : ""}`}
                    >
                      {desvioBase == null ? "—" : `${desvioBase > 0 ? "+" : ""}${desvioBase}d`}
                    </TableCell>
                    <TableCell className="text-xs">{m.data_realizado ?? "—"}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="icon"
                        aria-label="Concluir marco"
                        variant="ghost"
                        onClick={() => marcarRealizado(m)}
                        title={m.data_realizado ? "Desfazer" : "Marcar realizado"}
                      >
                        <CheckCircle2
                          className={`h-4 w-4 ${m.data_realizado ? "text-success" : "text-muted-foreground"}`}
                        />
                      </Button>
                      <Button
                        size="icon"
                        aria-label="Excluir marco"
                        variant="ghost"
                        onClick={() => remove(m.id)}
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
