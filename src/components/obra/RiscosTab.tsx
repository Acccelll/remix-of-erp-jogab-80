// CRUD de riscos PMBOK + matriz 5×5 + lista filtrável.
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, AlertTriangle, TrendingUp, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { riscosRepo } from "@/lib/repositories/planejamento";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { DesktopOnlyHint } from "@/components/common/DesktopOnlyHint";
import { EscopoBanner } from "@/components/planejamento/EscopoBanner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/obra/EmptyState";
import { QueryState } from "@/components/common/QueryState";
import { brl } from "@/lib/billing";
import { cn } from "@/lib/utils";
import {
  severidade,
  faixaSeveridade,
  corMatriz,
  corBadgeSeveridade,
  rotuloFaixa,
  PROBABILIDADE_LABELS,
  IMPACTO_LABELS,
} from "@/lib/pmbok/riscos";

type Risco = {
  id: string;
  obra_id: string;
  codigo: string | null;
  descricao: string;
  categoria: string | null;
  tipo: string;
  probabilidade: number;
  impacto: number;
  impacto_financeiro: number | null;
  resposta: string | null;
  plano_resposta: string | null;
  responsavel: string | null;
  status: string;
  data_revisao: string | null;
  observacoes: string | null;
};

import {
  STATUS_RISCO_OBRA_OPCOES as STATUS_OPCOES,
  STATUS_RISCO_OBRA_LABEL as STATUS_LABEL,
} from "@/lib/status";
const RESPOSTA_OPCOES_AMEACA = ["mitigar", "transferir", "evitar", "aceitar", "escalar"];
const RESPOSTA_OPCOES_OPORT = ["explorar", "compartilhar", "melhorar", "aceitar", "escalar"];
const CATEGORIAS = ["Técnico", "Externo", "Organizacional", "Gerência de projeto"];

function vazioRisco(obraId: string): Partial<Risco> {
  return {
    obra_id: obraId,
    codigo: "",
    descricao: "",
    categoria: "Técnico",
    tipo: "ameaca",
    probabilidade: 3,
    impacto: 3,
    status: "identificado",
  };
}

export function RiscosTab({ obraId }: { obraId: string }) {
  const qc = useQueryClient();
  const { data: riscos, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["riscos", obraId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("riscos")
        .select(
          "id, obra_id, codigo, descricao, categoria, tipo, probabilidade, impacto, impacto_financeiro, resposta, plano_resposta, responsavel, status, data_revisao, observacoes, created_at",
        )
        .eq("obra_id", obraId)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as Risco[];
    },
  });

  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");
  const [editing, setEditing] = useState<Partial<Risco> | null>(null);
  const [open, setOpen] = useState(false);

  const filtrados = useMemo(() => {
    return (riscos ?? []).filter((r) => {
      if (filtroStatus !== "todos" && r.status !== filtroStatus) return false;
      if (filtroCategoria !== "todas" && (r.categoria ?? "") !== filtroCategoria) return false;
      return true;
    });
  }, [riscos, filtroStatus, filtroCategoria]);

  async function salvar() {
    if (!editing) return;
    if (!editing.descricao?.trim()) {
      toast.error("Descrição é obrigatória");
      return;
    }
    const payload = {
      obra_id: obraId,
      codigo: editing.codigo || null,
      descricao: editing.descricao,
      categoria: editing.categoria || null,
      tipo: editing.tipo ?? "ameaca",
      probabilidade: Number(editing.probabilidade ?? 3),
      impacto: Number(editing.impacto ?? 3),
      impacto_financeiro:
        editing.impacto_financeiro != null && editing.impacto_financeiro !== ("" as any)
          ? Number(editing.impacto_financeiro)
          : null,
      resposta: (editing.resposta as any) || null,
      plano_resposta: editing.plano_resposta || null,
      responsavel: editing.responsavel || null,
      status: (editing.status ?? "identificado") as any,
      data_revisao: editing.data_revisao || null,
      observacoes: editing.observacoes || null,
    };
    try {
      await riscosRepo.upsert(editing.id, payload);
    } catch (error: any) {
      toast.error(error.message);
      return;
    }
    toast.success(editing.id ? "Risco atualizado" : "Risco criado");
    setOpen(false);
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["riscos", obraId] });
  }

  async function excluir(id: string) {
    try {
      await riscosRepo.remove(id);
    } catch (error: any) {
      toast.error(error.message);
      return;
    }
    toast.success("Risco removido");
    qc.invalidateQueries({ queryKey: ["riscos", obraId] });
  }

  function abrirNovo() {
    setEditing(vazioRisco(obraId));
    setOpen(true);
  }
  function abrirEditar(r: Risco) {
    setEditing(r);
    setOpen(true);
  }

  // Matriz 5x5: contagem por célula (eixo Y = probabilidade decrescente, eixo X = impacto)
  const matriz = useMemo(() => {
    const m: Record<string, Risco[]> = {};
    for (const r of filtrados) {
      const key = `${r.probabilidade}-${r.impacto}`;
      (m[key] ??= []).push(r);
    }
    return m;
  }, [filtrados]);

  return (
    <div className="space-y-6">
      <EscopoBanner nivel="obra" modulo="riscos" />
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos status</SelectItem>
              {STATUS_OPCOES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
            <SelectTrigger className="h-8 w-[180px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas categorias</SelectItem>
              {CATEGORIAS.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) setEditing(null);
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm" onClick={abrirNovo}>
              <Plus className="h-4 w-4 mr-1" /> Novo risco
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editing?.id ? "Editar risco" : "Novo risco"}</DialogTitle>
            </DialogHeader>
            {editing && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Código</Label>
                  <Input
                    value={editing.codigo ?? ""}
                    onChange={(e) => setEditing({ ...editing, codigo: e.target.value })}
                    placeholder="R-001"
                  />
                </div>
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <Select
                    value={editing.tipo ?? "ameaca"}
                    onValueChange={(v) => setEditing({ ...editing, tipo: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ameaca">Ameaça</SelectItem>
                      <SelectItem value="oportunidade">Oportunidade</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Descrição *</Label>
                  <Textarea
                    rows={2}
                    value={editing.descricao ?? ""}
                    onChange={(e) => setEditing({ ...editing, descricao: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Categoria</Label>
                  <Select
                    value={editing.categoria ?? ""}
                    onValueChange={(v) => setEditing({ ...editing, categoria: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Responsável</Label>
                  <Input
                    value={editing.responsavel ?? ""}
                    onChange={(e) => setEditing({ ...editing, responsavel: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Probabilidade (1-5)</Label>
                  <Select
                    value={String(editing.probabilidade ?? 3)}
                    onValueChange={(v) => setEditing({ ...editing, probabilidade: Number(v) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n} — {PROBABILIDADE_LABELS[n]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Impacto (1-5)</Label>
                  <Select
                    value={String(editing.impacto ?? 3)}
                    onValueChange={(v) => setEditing({ ...editing, impacto: Number(v) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n} — {IMPACTO_LABELS[n]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Impacto financeiro (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editing.impacto_financeiro ?? ""}
                    onChange={(e) =>
                      setEditing({ ...editing, impacto_financeiro: e.target.value as any })
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Resposta</Label>
                  <Select
                    value={editing.resposta ?? ""}
                    onValueChange={(v) => setEditing({ ...editing, resposta: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {(editing.tipo === "oportunidade"
                        ? RESPOSTA_OPCOES_OPORT
                        : RESPOSTA_OPCOES_AMEACA
                      ).map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Plano de resposta</Label>
                  <Textarea
                    rows={2}
                    value={editing.plano_resposta ?? ""}
                    onChange={(e) => setEditing({ ...editing, plano_resposta: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select
                    value={editing.status ?? "identificado"}
                    onValueChange={(v) => setEditing({ ...editing, status: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPCOES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Próxima revisão</Label>
                  <Input
                    type="date"
                    value={editing.data_revisao ?? ""}
                    onChange={(e) => setEditing({ ...editing, data_revisao: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Observações</Label>
                  <Textarea
                    rows={2}
                    value={editing.observacoes ?? ""}
                    onChange={(e) => setEditing({ ...editing, observacoes: e.target.value })}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={salvar}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Matriz 5x5 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Matriz de risco — Probabilidade × Impacto</CardTitle>
        </CardHeader>
        <CardContent>
          <DesktopOnlyHint label="Matriz de risco otimizada para desktop." />
          <div className="overflow-x-auto">
          <div className="flex min-w-[680px] items-stretch gap-2">
            {/* eixo Y labels */}
            <div className="flex flex-col-reverse justify-around text-[10px] text-muted-foreground pr-1">
              {[1, 2, 3, 4, 5].map((p) => (
                <div key={p} className="h-16 flex items-center justify-end whitespace-nowrap">
                  {p} · {PROBABILIDADE_LABELS[p]}
                </div>
              ))}
            </div>
            <div className="flex-1">
              <div className="grid grid-cols-5 gap-1">
                {/* render rows top to bottom: p=5..1 */}
                {[5, 4, 3, 2, 1].flatMap((p) =>
                  [1, 2, 3, 4, 5].map((i) => {
                    const itens = matriz[`${p}-${i}`] ?? [];
                    return (
                      <div
                        key={`${p}-${i}`}
                        className={cn(
                          "h-16 rounded-md p-1 flex flex-wrap content-start gap-1 overflow-hidden",
                          corMatriz(p, i),
                        )}
                        title={`P${p} × I${i} = ${p * i}`}
                      >
                        {itens.slice(0, 6).map((r) => (
                          <button
                            key={r.id}
                            onClick={() => abrirEditar(r)}
                            className="text-[10px] bg-white/85 hover:bg-white text-foreground rounded px-1 py-[1px] font-medium leading-tight"
                            title={r.descricao}
                          >
                            {r.codigo || r.descricao.slice(0, 8)}
                          </button>
                        ))}
                        {itens.length > 6 && (
                          <span className="text-[10px] bg-white/85 rounded px-1 text-foreground">
                            +{itens.length - 6}
                          </span>
                        )}
                      </div>
                    );
                  }),
                )}
              </div>
              <div className="grid grid-cols-5 gap-1 mt-1 text-[10px] text-muted-foreground">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="text-center">
                    {i} · {IMPACTO_LABELS[i]}
                  </div>
                ))}
              </div>
              <div className="text-[10px] text-muted-foreground mt-1 text-center">Impacto →</div>
            </div>
          </div>
          </div>
          <div className="flex items-center gap-3 mt-3 text-[11px]">
            <span className="text-muted-foreground">Severidade:</span>
            <span className="inline-flex items-center gap-1">
              <span className="h-3 w-3 rounded bg-success/70" /> Baixo
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-3 w-3 rounded bg-warning/80" /> Médio
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-3 w-3 rounded bg-warning/80" /> Alto
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-3 w-3 rounded bg-destructive/80" /> Crítico
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Lista */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Riscos registrados ({filtrados.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <QueryState
            isLoading={isLoading}
            isError={isError}
            error={error}
            data={filtrados}
            isEmpty={(d) => d.length === 0}
            onRetry={() => refetch()}
            empty={<EmptyState title="Sem riscos" description="Cadastre o primeiro risco identificado." />}
          >
            {(rows) => (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-center">P</TableHead>
                  <TableHead className="text-center">I</TableHead>
                  <TableHead className="text-center">Sev.</TableHead>
                  <TableHead>Resposta</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Impacto R$</TableHead>
                  <TableHead className="w-20 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const sev = severidade(r.probabilidade, r.impacto);
                  const faixa = faixaSeveridade(sev);
                  return (
                    <TableRow key={r.id} className="cursor-pointer" onClick={() => abrirEditar(r)}>
                      <TableCell>
                        {r.tipo === "oportunidade" ? (
                          <TrendingUp className="h-4 w-4 text-success" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-warning" />
                        )}
                      </TableCell>
                      <TableCell className="text-xs font-mono">{r.codigo ?? "—"}</TableCell>
                      <TableCell className="max-w-[280px] truncate">{r.descricao}</TableCell>
                      <TableCell className="text-xs">{r.categoria ?? "—"}</TableCell>
                      <TableCell className="text-center text-xs">{r.probabilidade}</TableCell>
                      <TableCell className="text-center text-xs">{r.impacto}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={cn("border", corBadgeSeveridade(sev))}>
                          {sev} · {rotuloFaixa(faixa)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{r.resposta ?? "—"}</TableCell>
                      <TableCell className="text-xs">
                        {STATUS_LABEL[r.status] ?? r.status}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {r.impacto_financeiro != null ? brl(Number(r.impacto_financeiro)) : "—"}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Editar risco"
                            className="h-7 w-7"
                            onClick={() => abrirEditar(r)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label="Excluir risco" className="h-7 w-7 text-destructive">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir risco?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => excluir(r.id)}>
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
            )}
          </QueryState>
        </CardContent>
      </Card>
    </div>
  );
}
