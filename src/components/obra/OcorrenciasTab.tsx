// Ocorrências (Issues) e Lições Aprendidas — PMBOK
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, AlertCircle, Lightbulb, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ocorrenciasRepo } from "@/lib/repositories/obraDetalhe";
import { licoesAprendidasRepo } from "@/lib/repositories/planejamento";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { cn } from "@/lib/utils";

type Ocorrencia = {
  id: string;
  obra_id: string;
  titulo: string;
  descricao: string | null;
  prioridade: string;
  status: string;
  responsavel: string | null;
  risco_id: string | null;
  data_abertura: string;
  data_resolucao: string | null;
  acao_corretiva: string | null;
};

type Licao = {
  id: string;
  obra_id: string;
  categoria: string | null;
  situacao: string;
  recomendacao: string;
  impacto: string | null;
  created_at: string;
};

import {
  STATUS_OCORRENCIA_OPCOES as STATUS_OC,
  STATUS_OCORRENCIA_LABEL as STATUS_LABEL,
} from "@/lib/status";
const PRIORIDADES = ["baixa", "media", "alta", "critica"];
const PRIORIDADE_LABEL: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};
const CATEGORIAS_LICAO = [
  "Cronograma",
  "Custo",
  "Qualidade",
  "Aquisições",
  "Segurança",
  "Comunicação",
  "Outro",
];

function corPrioridade(p: string) {
  switch (p) {
    case "critica":
      return "bg-destructive/15 text-destructive border-destructive/30";
    case "alta":
      return "bg-warning/15 text-warning border-warning/30";
    case "media":
      return "bg-warning/15 text-warning border-warning/30";
    default:
      return "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30";
  }
}

function corStatus(s: string) {
  switch (s) {
    case "aberta":
      return "bg-destructive/15 text-destructive border-destructive/30";
    case "em_andamento":
      return "bg-primary/15 text-primary border-primary/30";
    case "resolvida":
      return "bg-success/15 text-success border-success/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export function OcorrenciasTab({ obraId }: { obraId: string }) {
  return (
    <Tabs defaultValue="ocorrencias" className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="ocorrencias">
          <AlertCircle className="h-4 w-4 mr-1" /> Ocorrências
        </TabsTrigger>
        <TabsTrigger value="licoes">
          <Lightbulb className="h-4 w-4 mr-1" /> Lições Aprendidas
        </TabsTrigger>
      </TabsList>
      <TabsContent value="ocorrencias">
        <OcorrenciasSection obraId={obraId} />
      </TabsContent>
      <TabsContent value="licoes">
        <LicoesSection obraId={obraId} />
      </TabsContent>
    </Tabs>
  );
}

function OcorrenciasSection({ obraId }: { obraId: string }) {
  const qc = useQueryClient();
  const { data: ocorrencias, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["ocorrencias", obraId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ocorrencias")
        .select(
          "id, obra_id, titulo, descricao, prioridade, status, responsavel, risco_id, data_abertura, data_resolucao, acao_corretiva",
        )
        .eq("obra_id", obraId)
        .order("data_abertura", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as Ocorrencia[];
    },
  });

  const { data: riscos } = useQuery({
    queryKey: ["riscos_select", obraId],
    queryFn: async () => {
      const { data } = await supabase
        .from("riscos")
        .select("id, codigo, descricao")
        .eq("obra_id", obraId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const [editing, setEditing] = useState<Partial<Ocorrencia> | null>(null);
  const [open, setOpen] = useState(false);

  function novo() {
    setEditing({
      obra_id: obraId,
      titulo: "",
      descricao: "",
      prioridade: "media",
      status: "aberta",
      data_abertura: new Date().toISOString().slice(0, 10),
    });
    setOpen(true);
  }

  async function salvar() {
    if (!editing?.titulo?.trim()) {
      toast.error("Informe um título");
      return;
    }
    const payload: any = {
      obra_id: obraId,
      titulo: editing.titulo,
      descricao: editing.descricao || null,
      prioridade: editing.prioridade || "media",
      status: editing.status || "aberta",
      responsavel: editing.responsavel || null,
      risco_id: editing.risco_id || null,
      data_abertura: editing.data_abertura || new Date().toISOString().slice(0, 10),
      data_resolucao: editing.data_resolucao || null,
      acao_corretiva: editing.acao_corretiva || null,
    };
    try {
      await ocorrenciasRepo.upsert(editing.id, payload);
    } catch (error: any) {
      toast.error(error.message);
      return;
    }
    toast.success(editing.id ? "Ocorrência atualizada" : "Ocorrência criada");
    setOpen(false);
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["ocorrencias", obraId] });
  }

  async function remover(id: string) {
    try {
      await ocorrenciasRepo.remove(id);
    } catch (error: any) {
      return toast.error(error.message);
    }
    toast.success("Ocorrência removida");
    qc.invalidateQueries({ queryKey: ["ocorrencias", obraId] });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Registro de Ocorrências</CardTitle>
        <Button size="sm" onClick={novo}>
          <Plus className="h-4 w-4 mr-1" /> Nova
        </Button>
      </CardHeader>
      <CardContent>
        <QueryState
          isLoading={isLoading}
          isError={isError}
          error={error}
          data={ocorrencias ?? []}
          isEmpty={(d) => d.length === 0}
          onRetry={() => refetch()}
          empty={
            <EmptyState
              title="Sem ocorrências"
              description="Registre problemas, atrasos ou eventos que afetem a obra."
            />
          }
        >
          {(list) => (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Abertura</TableHead>
                <TableHead>Risco</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((o) => {
                const risco = riscos?.find((r: any) => r.id === o.risco_id);
                return (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.titulo}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn("text-xs", corPrioridade(o.prioridade))}
                      >
                        {PRIORIDADE_LABEL[o.prioridade] ?? o.prioridade}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-xs", corStatus(o.status))}>
                        {STATUS_LABEL[o.status] ?? o.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{o.responsavel ?? "—"}</TableCell>
                    <TableCell className="text-sm">{o.data_abertura}</TableCell>
                    <TableCell className="text-sm">
                      {risco ? (
                        <span className="inline-flex items-center gap-1 text-xs">
                          <Link2 className="h-3 w-3" />
                          {(risco as any).codigo || (risco as any).descricao?.slice(0, 30)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Editar ocorrência"
                          className="h-7 w-7"
                          onClick={() => {
                            setEditing(o);
                            setOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Excluir ocorrência"
                              className="h-7 w-7 text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover ocorrência?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => remover(o.id)}>
                                Remover
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
          )}
        </QueryState>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar ocorrência" : "Nova ocorrência"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid gap-3">
              <div>
                <Label>Título</Label>
                <Input
                  value={editing.titulo ?? ""}
                  onChange={(e) => setEditing({ ...editing, titulo: e.target.value })}
                />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea
                  value={editing.descricao ?? ""}
                  onChange={(e) => setEditing({ ...editing, descricao: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Prioridade</Label>
                  <Select
                    value={editing.prioridade ?? "media"}
                    onValueChange={(v) => setEditing({ ...editing, prioridade: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORIDADES.map((p) => (
                        <SelectItem key={p} value={p}>
                          {PRIORIDADE_LABEL[p]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select
                    value={editing.status ?? "aberta"}
                    onValueChange={(v) => setEditing({ ...editing, status: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OC.map((s) => (
                        <SelectItem key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Responsável</Label>
                  <Input
                    value={editing.responsavel ?? ""}
                    onChange={(e) => setEditing({ ...editing, responsavel: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Risco vinculado (opcional)</Label>
                  <Select
                    value={editing.risco_id ?? "none"}
                    onValueChange={(v) =>
                      setEditing({ ...editing, risco_id: v === "none" ? null : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sem vínculo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem vínculo</SelectItem>
                      {(riscos ?? []).map((r: any) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.codigo ? `${r.codigo} — ` : ""}
                          {r.descricao?.slice(0, 60)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Data de abertura</Label>
                  <Input
                    type="date"
                    value={editing.data_abertura ?? ""}
                    onChange={(e) => setEditing({ ...editing, data_abertura: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Data de resolução</Label>
                  <Input
                    type="date"
                    value={editing.data_resolucao ?? ""}
                    onChange={(e) =>
                      setEditing({ ...editing, data_resolucao: e.target.value || null })
                    }
                  />
                </div>
              </div>
              <div>
                <Label>Ação corretiva</Label>
                <Textarea
                  value={editing.acao_corretiva ?? ""}
                  onChange={(e) => setEditing({ ...editing, acao_corretiva: e.target.value })}
                  rows={3}
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
    </Card>
  );
}

function LicoesSection({ obraId }: { obraId: string }) {
  const qc = useQueryClient();
  const { data: licoes, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["licoes", obraId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("licoes_aprendidas")
        .select("id, obra_id, categoria, situacao, recomendacao, impacto, created_at")
        .eq("obra_id", obraId)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as Licao[];
    },
  });

  const [editing, setEditing] = useState<Partial<Licao> | null>(null);
  const [open, setOpen] = useState(false);

  function novo() {
    setEditing({
      obra_id: obraId,
      categoria: "Cronograma",
      situacao: "",
      recomendacao: "",
      impacto: "negativo",
    });
    setOpen(true);
  }

  async function salvar() {
    if (!editing?.situacao?.trim() || !editing?.recomendacao?.trim()) {
      toast.error("Informe a situação e a recomendação");
      return;
    }
    const payload: any = {
      obra_id: obraId,
      categoria: editing.categoria || null,
      situacao: editing.situacao,
      recomendacao: editing.recomendacao,
      impacto: editing.impacto || null,
    };
    try {
      await licoesAprendidasRepo.upsert(editing.id, payload);
    } catch (error: any) {
      return toast.error(error.message);
    }
    toast.success(editing.id ? "Lição atualizada" : "Lição registrada");
    setOpen(false);
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["licoes", obraId] });
  }

  async function remover(id: string) {
    try {
      await licoesAprendidasRepo.remove(id);
    } catch (error: any) {
      return toast.error(error.message);
    }
    toast.success("Lição removida");
    qc.invalidateQueries({ queryKey: ["licoes", obraId] });
  }

  // Agrupa por categoria
  const grupos = (licoes ?? []).reduce<Record<string, Licao[]>>((acc, l) => {
    const k = l.categoria || "Sem categoria";
    (acc[k] ||= []).push(l);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Lições Aprendidas</CardTitle>
        <Button size="sm" onClick={novo}>
          <Plus className="h-4 w-4 mr-1" /> Nova
        </Button>
      </CardHeader>
      <CardContent>
        <QueryState
          isLoading={isLoading}
          isError={isError}
          error={error}
          data={licoes ?? []}
          isEmpty={(d) => d.length === 0}
          onRetry={() => refetch()}
          empty={
            <EmptyState
              title="Sem lições registradas"
              description="Documente o que aprendeu para reusar em próximas obras."
            />
          }
        >
          {() => (
          <div className="space-y-6">
            {Object.entries(grupos).map(([cat, items]) => (
              <div key={cat}>
                <h4 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">
                  {cat}
                </h4>
                <div className="grid gap-2">
                  {items.map((l) => (
                    <div key={l.id} className="border rounded-md p-3 bg-card">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            {l.impacto && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-xs",
                                  l.impacto === "positivo"
                                    ? "bg-success/15 text-success border-success/30"
                                    : "bg-warning/15 text-warning border-warning/30",
                                )}
                              >
                                {l.impacto === "positivo" ? "Positivo" : "Negativo"}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm">
                            <span className="font-medium">Situação:</span> {l.situacao}
                          </p>
                          <p className="text-sm">
                            <span className="font-medium">Recomendação:</span> {l.recomendacao}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Editar ocorrência"
                            className="h-7 w-7"
                            onClick={() => {
                              setEditing(l);
                              setOpen(true);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Excluir ocorrência"
                                className="h-7 w-7 text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remover lição?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => remover(l.id)}>
                                  Remover
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          )}
        </QueryState>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar lição" : "Nova lição"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Categoria</Label>
                  <Select
                    value={editing.categoria ?? "Cronograma"}
                    onValueChange={(v) => setEditing({ ...editing, categoria: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS_LICAO.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Impacto</Label>
                  <Select
                    value={editing.impacto ?? "negativo"}
                    onValueChange={(v) => setEditing({ ...editing, impacto: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="positivo">Positivo</SelectItem>
                      <SelectItem value="negativo">Negativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Situação (o que aconteceu)</Label>
                <Textarea
                  value={editing.situacao ?? ""}
                  onChange={(e) => setEditing({ ...editing, situacao: e.target.value })}
                  rows={3}
                />
              </div>
              <div>
                <Label>Recomendação (o que fazer da próxima vez)</Label>
                <Textarea
                  value={editing.recomendacao ?? ""}
                  onChange={(e) => setEditing({ ...editing, recomendacao: e.target.value })}
                  rows={3}
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
    </Card>
  );
}
