import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FlaskConical, Plus, Trash2, Wand2, X, Check, Calendar } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cronogramaCenariosFns as cronogramaCenariosRepo, cronogramaCenarioItensFns as cronogramaCenarioItensRepo } from "@/hooks/obras/useCronograma";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  clonarItensParaCenario,
  compararCenario,
  resumoCenario,
  ajustarSnapshot,
  type CenarioItemBase,
  type CenarioSnapshot,
} from "@/lib/cronograma/cenarios";

type Cenario = {
  id: string;
  obra_id: string;
  nome: string;
  descricao: string | null;
  status: string;
  criado_por: string | null;
  created_at: string;
  aplicado_em: string | null;
};

type CenarioItem = {
  id: string;
  cenario_id: string;
  item_id: string;
  data_inicio_origem: string;
  data_fim_origem: string;
  data_inicio_sim: string;
  data_fim_sim: string;
  observacao: string | null;
};

interface Props {
  obraId: string;
  itens: CenarioItemBase[];
  podeEditar: boolean;
}

export function CenariosSheet({ obraId, itens, podeEditar }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [cenarioId, setCenarioId] = useState<string | null>(null);
  const [novoNome, setNovoNome] = useState("");
  const [novoDesc, setNovoDesc] = useState("");

  const { data: cenarios = [] } = useQuery({
    queryKey: ["cenarios", obraId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cronograma_cenarios")
        .select(
          "id,obra_id,nome,descricao,criado_por,status,aplicado_em,aplicado_por,created_at,updated_at",
        )
        .eq("obra_id", obraId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Cenario[];
    },
    enabled: open,
  });

  const { data: cenarioItens = [] } = useQuery({
    queryKey: ["cenario-itens", cenarioId],
    queryFn: async () => {
      if (!cenarioId) return [];
      const { data, error } = await supabase
        .from("cronograma_cenario_itens")
        .select(
          "id,cenario_id,item_id,data_inicio_origem,data_fim_origem,data_inicio_sim,data_fim_sim,observacao,created_at,updated_at",
        )
        .eq("cenario_id", cenarioId);
      if (error) throw error;
      return (data ?? []) as CenarioItem[];
    },
    enabled: !!cenarioId,
  });

  const criarCenario = useMutation({
    mutationFn: async () => {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      const { data: cen, error } = await supabase
        .from("cronograma_cenarios")
        .insert({
          obra_id: obraId,
          nome: novoNome.trim() || `Cenário ${format(new Date(), "dd/MM HH:mm")}`,
          descricao: novoDesc.trim() || null,
          criado_por: userId,
          status: "rascunho",
        })
        .select(
          "id,obra_id,nome,descricao,criado_por,status,aplicado_em,aplicado_por,created_at,updated_at",
        )
        .single();
      if (error) throw error;

      const snaps = clonarItensParaCenario(itens);
      if (snaps.length > 0) {
        const rows = snaps.map((s) => ({
          cenario_id: cen.id,
          item_id: s.item_id,
          data_inicio_origem: s.data_inicio_origem,
          data_fim_origem: s.data_fim_origem,
          data_inicio_sim: s.data_inicio_sim,
          data_fim_sim: s.data_fim_sim,
        }));
        await cronogramaCenarioItensRepo.insertMany(rows);
      }
      return cen as Cenario;
    },
    onSuccess: (cen) => {
      toast.success("Cenário criado");
      setNovoNome("");
      setNovoDesc("");
      setCenarioId(cen.id);
      qc.invalidateQueries({ queryKey: ["cenarios", obraId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao criar cenário"),
  });

  const excluirCenario = useMutation({
    mutationFn: async (id: string) => {
      await cronogramaCenariosRepo.remove(id);
    },
    onSuccess: () => {
      toast.success("Cenário excluído");
      setCenarioId(null);
      qc.invalidateQueries({ queryKey: ["cenarios", obraId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const atualizarItem = useMutation({
    mutationFn: async (patch: {
      id: string;
      data_inicio_sim?: string;
      data_fim_sim?: string;
      observacao?: string;
    }) => {
      const { error } = await supabase
        .from("cronograma_cenario_itens")
        .update({
          ...(patch.data_inicio_sim !== undefined
            ? { data_inicio_sim: patch.data_inicio_sim }
            : {}),
          ...(patch.data_fim_sim !== undefined ? { data_fim_sim: patch.data_fim_sim } : {}),
          ...(patch.observacao !== undefined ? { observacao: patch.observacao } : {}),
        })
        .eq("id", patch.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cenario-itens", cenarioId] }),
    onError: (e: any) => toast.error(e.message),
  });

  const aplicarAoReal = useMutation({
    mutationFn: async () => {
      if (!cenarioId) return;
      // Persiste cada delta no cronograma_itens. Não usa lock otimista aqui porque
      // a aplicação é deliberada — operador escolheu sobrescrever a base.
      const alterados = cenarioItens.filter(
        (c) => c.data_inicio_sim !== c.data_inicio_origem || c.data_fim_sim !== c.data_fim_origem,
      );
      for (const c of alterados) {
        const { error } = await supabase
          .from("cronograma_itens")
          .update({ data_inicio: c.data_inicio_sim, data_fim: c.data_fim_sim })
          .eq("id", c.item_id);
        if (error) throw error;
      }
      const userId = (await supabase.auth.getUser()).data.user?.id;
      const { error: e2 } = await supabase
        .from("cronograma_cenarios")
        .update({ status: "aplicado", aplicado_em: new Date().toISOString(), aplicado_por: userId })
        .eq("id", cenarioId);
      if (e2) throw e2;
      return alterados.length;
    },
    onSuccess: (n) => {
      toast.success(`Cenário aplicado · ${n ?? 0} atividade(s) atualizadas`);
      qc.invalidateQueries({ queryKey: ["cronograma", obraId] });
      qc.invalidateQueries({ queryKey: ["crono", obraId] });
      qc.invalidateQueries({ queryKey: ["cenarios", obraId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const descartar = useMutation({
    mutationFn: async () => {
      if (!cenarioId) return;
      const { error } = await supabase
        .from("cronograma_cenarios")
        .update({ status: "descartado" })
        .eq("id", cenarioId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cenário descartado");
      qc.invalidateQueries({ queryKey: ["cenarios", obraId] });
    },
  });

  const cenarioAberto = cenarios.find((c) => c.id === cenarioId) ?? null;

  const snapshots: CenarioSnapshot[] = useMemo(
    () =>
      cenarioItens.map((c) => ({
        item_id: c.item_id,
        data_inicio_origem: c.data_inicio_origem,
        data_fim_origem: c.data_fim_origem,
        data_inicio_sim: c.data_inicio_sim,
        data_fim_sim: c.data_fim_sim,
        observacao: c.observacao,
      })),
    [cenarioItens],
  );

  const diff = useMemo(() => compararCenario(itens, snapshots), [itens, snapshots]);
  const resumo = useMemo(() => resumoCenario(diff), [diff]);
  const linhasAlteradas = diff.filter((d) => d.alterado);

  const fmt = (s: string) => format(new Date(s + "T00:00:00"), "dd/MM/yy", { locale: ptBR });
  const fmtDelta = (n: number) => (n === 0 ? "—" : n > 0 ? `+${n}d` : `${n}d`);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 gap-1">
          <FlaskConical className="h-3.5 w-3.5" />
          Cenários
          {cenarios.filter((c) => c.status === "rascunho").length > 0 && (
            <Badge variant="secondary" className="h-4 px-1 text-[10px]">
              {cenarios.filter((c) => c.status === "rascunho").length}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-4xl overflow-hidden flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4" />
            Cenários what-if
          </SheetTitle>
        </SheetHeader>

        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4 mt-3 flex-1 overflow-hidden">
          {/* Coluna lista */}
          <div className="flex flex-col gap-3 overflow-hidden">
            {podeEditar && (
              <div className="space-y-2 border rounded-md p-2">
                <Label className="text-xs">Novo cenário</Label>
                <Input
                  placeholder="Nome"
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  className="h-8"
                />
                <Textarea
                  placeholder="Descrição (opcional)"
                  value={novoDesc}
                  onChange={(e) => setNovoDesc(e.target.value)}
                  rows={2}
                  className="text-xs"
                />
                <Button
                  size="sm"
                  className="w-full h-7 gap-1"
                  onClick={() => criarCenario.mutate()}
                  disabled={criarCenario.isPending}
                >
                  <Plus className="h-3.5 w-3.5" /> Criar a partir do atual
                </Button>
              </div>
            )}
            <Separator />
            <ScrollArea className="flex-1">
              <div className="space-y-1 pr-2">
                {cenarios.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCenarioId(c.id)}
                    className={`w-full text-left rounded-md border px-2 py-1.5 text-sm hover:bg-muted/50 ${
                      cenarioId === c.id ? "bg-muted border-primary" : ""
                    }`}
                  >
                    <div className="font-medium truncate">{c.nome}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge
                        variant={
                          c.status === "aplicado"
                            ? "default"
                            : c.status === "descartado"
                              ? "secondary"
                              : "outline"
                        }
                        className="text-[10px] h-4 px-1"
                      >
                        {c.status}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(c.created_at), "dd/MM HH:mm")}
                      </span>
                    </div>
                  </button>
                ))}
                {cenarios.length === 0 && (
                  <div className="text-xs text-muted-foreground p-2 text-center">
                    Nenhum cenário ainda.
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Coluna detalhe */}
          <div className="flex flex-col overflow-hidden border rounded-md">
            {!cenarioAberto ? (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                Selecione ou crie um cenário
              </div>
            ) : (
              <>
                <div className="p-3 border-b space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{cenarioAberto.nome}</div>
                      {cenarioAberto.descricao && (
                        <div className="text-xs text-muted-foreground">
                          {cenarioAberto.descricao}
                        </div>
                      )}
                    </div>
                    {podeEditar && cenarioAberto.status === "rascunho" && (
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 gap-1"
                          onClick={() => aplicarAoReal.mutate()}
                          disabled={aplicarAoReal.isPending || linhasAlteradas.length === 0}
                        >
                          <Check className="h-3.5 w-3.5" /> Aplicar ao real
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1"
                          onClick={() => descartar.mutate()}
                        >
                          <X className="h-3.5 w-3.5" /> Descartar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => excluirCenario.mutate(cenarioAberto.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <Stat label="Itens" value={String(resumo.total_itens)} />
                    <Stat
                      label="Alterados"
                      value={String(resumo.alterados)}
                      accent={resumo.alterados > 0}
                    />
                    <Stat
                      label="Δ Término"
                      value={fmtDelta(resumo.delta_termino_dias)}
                      accent={resumo.delta_termino_dias !== 0}
                      danger={resumo.delta_termino_dias > 0}
                    />
                    <Stat
                      label="Críticos"
                      value={String(resumo.criticos_impactados)}
                      danger={resumo.criticos_impactados > 0}
                    />
                  </div>
                </div>
                <ScrollArea className="flex-1">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead className="text-xs">Atividade</TableHead>
                        <TableHead className="text-xs">Original</TableHead>
                        <TableHead className="text-xs">Simulado</TableHead>
                        <TableHead className="text-xs text-right">Δ ini</TableHead>
                        <TableHead className="text-xs text-right">Δ fim</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {diff.map((d) => {
                        const ci = cenarioItens.find((c) => c.item_id === d.item_id);
                        if (!ci) return null;
                        const editavel = podeEditar && cenarioAberto.status === "rascunho";
                        return (
                          <TableRow key={d.item_id} className={d.alterado ? "bg-warning/5" : ""}>
                            <TableCell className="text-xs max-w-[220px]">
                              <div className="truncate flex items-center gap-1">
                                {d.critico && (
                                  <span className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
                                )}
                                {d.descricao ?? d.item_id.slice(0, 8)}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                              {fmt(d.data_inicio_origem)} → {fmt(d.data_fim_origem)}
                            </TableCell>
                            <TableCell className="text-xs whitespace-nowrap">
                              {editavel ? (
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="date"
                                    value={d.data_inicio_sim}
                                    onChange={(e) =>
                                      atualizarItem.mutate({
                                        id: ci.id,
                                        data_inicio_sim: e.target.value,
                                      })
                                    }
                                    className="h-6 text-xs px-1 w-[120px]"
                                  />
                                  <Input
                                    type="date"
                                    value={d.data_fim_sim}
                                    onChange={(e) =>
                                      atualizarItem.mutate({
                                        id: ci.id,
                                        data_fim_sim: e.target.value,
                                      })
                                    }
                                    className="h-6 text-xs px-1 w-[120px]"
                                  />
                                </div>
                              ) : (
                                <span>
                                  {fmt(d.data_inicio_sim)} → {fmt(d.data_fim_sim)}
                                </span>
                              )}
                            </TableCell>
                            <TableCell
                              className={`text-xs text-right whitespace-nowrap ${
                                d.delta_inicio_dias > 0
                                  ? "text-destructive"
                                  : d.delta_inicio_dias < 0
                                    ? "text-success"
                                    : ""
                              }`}
                            >
                              {fmtDelta(d.delta_inicio_dias)}
                            </TableCell>
                            <TableCell
                              className={`text-xs text-right whitespace-nowrap ${
                                d.delta_fim_dias > 0
                                  ? "text-destructive"
                                  : d.delta_fim_dias < 0
                                    ? "text-success"
                                    : ""
                              }`}
                            >
                              {fmtDelta(d.delta_fim_dias)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Stat({
  label,
  value,
  accent,
  danger,
}: {
  label: string;
  value: string;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-md border px-2 py-1 ${
        danger
          ? "border-destructive/40 bg-destructive/5"
          : accent
            ? "border-warning/40 bg-warning/5"
            : ""
      }`}
    >
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className={`text-sm font-semibold ${danger ? "text-destructive" : ""}`}>{value}</div>
    </div>
  );
}
