// @ts-nocheck
/**
 * INSP.7 — Tratativa de Não Conformidades
 * - Lista com filtros (obra, severidade, status, busca)
 * - Edição 5W2H + ações corretiva/preventiva
 * - Upload de evidência (bucket inspecoes-fotos, prefixo nc-evidencias/)
 * - Fechamento (resolvida) com timestamp e usuário
 */
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { naoConformidadesRepo, ncWorkflowFromRow } from "@/lib/repositories/inspecoes";
import type { NCEvent, NCTransitionError } from "@/lib/qualidade/nc-workflow";

import { useCatalogos } from "@/contexts/catalogos/useCatalogos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DatePickerField from "@/components/common/DatePickerField";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  ShieldAlert,
  CheckCircle2,
  Upload,
  ImageIcon,
  Search,
  RotateCcw,
  X,
  Repeat,
  BellRing,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BadgeSeveridade } from "@/components/qualidade/BadgeSeveridade";
import { useUrlState } from "@/hooks/useUrlState";
import { fmtDataLocal } from "@/lib/core/date";

type NCStatus = "aberta" | "em_tratativa" | "resolvida" | "cancelada";
type NCSev = "baixa" | "media" | "alta" | "critica";

interface NCRow {
  id: string;
  obra_id: string | null;
  inspecao_id: string | null;
  codigo: string | null;
  titulo: string;
  descricao: string | null;
  severidade: NCSev;
  status: NCStatus;
  o_que: string | null;
  por_que: string | null;
  onde: string | null;
  quando_planejado: string | null;
  quem: string | null;
  como: string | null;
  quanto: number | null;
  acao_corretiva: string | null;
  acao_preventiva: string | null;
  evidencia_path: string | null;
  resolvida_em: string | null;
  resolvida_por: string | null;
  created_at: string;
  reincidencia_de: string | null;
  // Workflow (PRO-007)
  responsavel_id: string | null;
  prazo: string | null;
  tratativa: string | null;
  reinspecao_resultado: "aprovada" | "reprovada" | null;
  reinspecionada_em: string | null;
  encerrada_em: string | null;
  aguardando_reinspecao: boolean | null;
}

const NC_ERR_LABEL: Record<NCTransitionError, string> = {
  "transicao-invalida": "Transição inválida a partir do estado atual",
  "responsavel-obrigatorio": "Informe o responsável (Quem)",
  "prazo-invalido": "Prazo inválido",
  "prazo-no-passado": "Prazo não pode ser no passado",
  "tratativa-obrigatoria": "Preencha a tratativa (Como) antes de continuar",
  "sem-tratativa-para-reinspecao": "Registre a tratativa antes de solicitar reinspeção",
};

/**
 * Tokens semânticos para o status da NC (espelham o ciclo: aberto→tratativa→resolvido).
 * Severidade fica por conta de `BadgeSeveridade` (tokens `--sev-*`).
 */
import { STATUS_NC_COLOR as statusColor, STATUS_NC_LABEL as STATUS_LABEL } from "@/lib/status";

export default function NaoConformidades() {
  const qc = useQueryClient();
  const { obras, players } = useCatalogos();
  const responsaveis = useMemo(
    () => [...players].sort((a, b) => (a.login || "").localeCompare(b.login || "", "pt-BR")),
    [players],
  );
  const [obraId, setObraId] = useUrlState("obra", "all");
  const [sev, setSev] = useUrlState("gravidade", "all");
  const [statusStr, setStatusStr] = useUrlState("status", "abertas");
  const status = statusStr as "abertas" | "all" | NCStatus;
  const setStatus = (v: "abertas" | "all" | NCStatus) => setStatusStr(v);
  const [busca, setBusca] = useUrlState("q", "");
  const [editing, setEditing] = useState<NCRow | null>(null);
  const [evidenciaUrl, setEvidenciaUrl] = useState<string | null>(null);

  const { data: ncs = [], isLoading } = useQuery({
    queryKey: ["ncs", obraId, sev, status],
    queryFn: async () => {
      let q = supabase
        .from("nao_conformidades")
        .select(
          "id, obra_id, inspecao_id, resposta_id, card_id, cronograma_item_id, codigo, titulo, descricao, severidade, status, o_que, por_que, onde, quando_planejado, quem, como, quanto, assinatura, reincidencia_de, acao_corretiva, acao_preventiva, evidencia_path, resolvida_em, resolvida_por, created_by, created_at, updated_at, responsavel_id, prazo, tratativa, reinspecao_resultado, reinspecionada_em, encerrada_em, aguardando_reinspecao",
        )
        .order("created_at", { ascending: false })
        .limit(500);
      if (obraId !== "all") q = q.eq("obra_id", obraId);
      if (sev !== "all") q = q.eq("severidade", sev);
      if (status === "abertas") q = q.neq("status", "resolvida").neq("status", "cancelada");
      else if (status !== "all") q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as NCRow[];
    },
  });

  const reincidenciaIds = useMemo(
    () => Array.from(new Set(ncs.map((n) => n.reincidencia_de).filter((x): x is string => !!x))),
    [ncs],
  );

  const { data: origens = [] } = useQuery({
    queryKey: ["ncs", "origens", reincidenciaIds],
    enabled: reincidenciaIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nao_conformidades")
        .select("id,codigo,titulo,created_at")
        .in("id", reincidenciaIds);
      if (error) throw error;
      return data ?? [];
    },
  });
  const origemMap = useMemo(() => new Map(origens.map((o) => [o.id, o])), [origens]);

  const obraMap = useMemo(() => new Map(obras.map((o) => [o.id, o.nome])), [obras]);
  const respMap = useMemo(
    () => new Map(responsaveis.map((p) => [p.id, p.login || p.email || p.id])),
    [responsaveis],
  );

  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return ncs;
    return ncs.filter(
      (n) =>
        n.titulo?.toLowerCase().includes(t) ||
        n.codigo?.toLowerCase().includes(t) ||
        n.descricao?.toLowerCase().includes(t),
    );
  }, [ncs, busca]);

  async function openEdit(nc: NCRow) {
    setEditing({ ...nc });
    setEvidenciaUrl(null);
    if (nc.evidencia_path) {
      const { data } = await supabase.storage
        .from("inspecoes-fotos")
        .createSignedUrl(nc.evidencia_path, 3600);
      setEvidenciaUrl(data?.signedUrl ?? null);
    }
  }

  function patch<K extends keyof NCRow>(k: K, v: NCRow[K]) {
    setEditing((prev) => (prev ? { ...prev, [k]: v } : prev));
  }

  async function uploadEvidencia(file: File) {
    if (!editing) return;
    const ext = file.name.split(".").pop() || "jpg";
    const path = `nc-evidencias/${editing.id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("inspecoes-fotos")
      .upload(path, file, { upsert: false, contentType: file.type });
    if (error) {
      toast.error("Falha ao enviar evidência: " + error.message);
      return;
    }
    patch("evidencia_path", path);
    const { data } = await supabase.storage.from("inspecoes-fotos").createSignedUrl(path, 3600);
    setEvidenciaUrl(data?.signedUrl ?? null);
    toast.success("Evidência enviada");
  }

  async function salvar(novoStatus?: NCStatus) {
    if (!editing) return;
    const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
    const update: Partial<NCRow> = {
      titulo: editing.titulo,
      descricao: editing.descricao,
      severidade: editing.severidade,
      status: novoStatus ?? editing.status,
      o_que: editing.o_que,
      por_que: editing.por_que,
      onde: editing.onde,
      quando_planejado: editing.quando_planejado,
      quem: editing.quem,
      como: editing.como,
      quanto: editing.quanto,
      acao_corretiva: editing.acao_corretiva,
      acao_preventiva: editing.acao_preventiva,
      evidencia_path: editing.evidencia_path,
    };
    if (novoStatus === "resolvida") {
      update.resolvida_em = new Date().toISOString();
      update.resolvida_por = userId;
    } else if (novoStatus) {
      update.resolvida_em = null;
      update.resolvida_por = null;
    }
    try {
      await naoConformidadesRepo.update(editing.id, update);
    } catch (e: any) {
      toast.error("Erro ao salvar: " + (e?.message ?? String(e)));
      return;
    }
    toast.success(novoStatus === "resolvida" ? "NC fechada" : "NC atualizada");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["ncs"] });
  }

  const fsm = editing ? ncWorkflowFromRow(editing as any) : null;

  async function runTransition(event: NCEvent, successMsg: string) {
    if (!editing) return;
    try {
      const result = await naoConformidadesRepo.applyTransition(editing.id, event);
      if (!result.ok) {
        toast.error(NC_ERR_LABEL[result.error]);
        return;
      }
      toast.success(successMsg);
      qc.invalidateQueries({ queryKey: ["ncs"] });
      const finalStates = ["resolvida", "cancelada"];
      if (finalStates.includes(result.state.status)) {
        setEditing(null);
      } else {
        // reload fresh row into editing state
        const { data } = await supabase
          .from("nao_conformidades")
          .select(
            "id, obra_id, inspecao_id, resposta_id, card_id, cronograma_item_id, codigo, titulo, descricao, severidade, status, o_que, por_que, onde, quando_planejado, quem, como, quanto, assinatura, reincidencia_de, acao_corretiva, acao_preventiva, evidencia_path, resolvida_em, resolvida_por, created_by, created_at, updated_at, responsavel_id, prazo, tratativa, reinspecao_resultado, reinspecionada_em, encerrada_em, aguardando_reinspecao",
          )
          .eq("id", editing.id)
          .single();
        if (data) setEditing(data as any as NCRow);
      }
    } catch (e: any) {
      toast.error("Erro: " + (e?.message ?? String(e)));
    }
  }

  const podeFechar = editing
    ? !!(
        editing.acao_corretiva &&
        editing.acao_corretiva.trim().length > 0 &&
        editing.evidencia_path
      )
    : false;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-6 w-6 text-destructive" />
          <div>
            <h1 className="text-2xl font-bold">Não Conformidades</h1>
            <p className="text-sm text-muted-foreground">
              Tratativa 5W2H, ações corretivas e fechamento com evidência
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            try {
              const data = await naoConformidadesRepo.notificarPrazos();
              toast.success(`${data ?? 0} notificação(ões) de prazo enviadas`);
            } catch (e: any) {
              toast.error("Erro: " + (e?.message ?? String(e)));
            }
          }}
        >
          <BellRing className="h-4 w-4 mr-1" /> Verificar prazos
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[240px]">
              <Label className="text-xs">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="código, título, descrição"
                />
              </div>
            </div>
            <div className="w-48">
              <Label className="text-xs">Obra</Label>
              <Select value={obraId} onValueChange={setObraId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {obras.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-36">
              <Label className="text-xs">Severidade</Label>
              <Select value={sev} onValueChange={setSev}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="critica">Crítica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-40">
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="abertas">Em aberto</SelectItem>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="aberta">Aberta</SelectItem>
                  <SelectItem value="em_tratativa">Em tratativa</SelectItem>
                  <SelectItem value="resolvida">Resolvida</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setBusca("");
                setObraId("all");
                setSev("all");
                setStatus("abertas");
              }}
            >
              <RotateCcw className="h-4 w-4 mr-1" /> Limpar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Código</TableHead>
                <TableHead>Título</TableHead>
                <TableHead className="w-40">Obra</TableHead>
                <TableHead className="w-28">Severidade</TableHead>
                <TableHead className="w-32">Status</TableHead>
                <TableHead className="w-32">Prazo</TableHead>
                <TableHead className="w-32">Responsável</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Carregando…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && filtradas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Nenhuma NC encontrada
                  </TableCell>
                </TableRow>
              )}
              {filtradas.map((nc) => (
                <TableRow
                  key={nc.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => openEdit(nc)}
                >
                  <TableCell className="font-mono text-xs">{nc.codigo ?? "—"}</TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span>{nc.titulo}</span>
                      {nc.reincidencia_de && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge
                                variant="outline"
                                className="bg-accent/15 text-accent-foreground border-accent/40 gap-1"
                              >
                                <Repeat className="h-3 w-3" /> Reincidente
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              {(() => {
                                const o = origemMap.get(nc.reincidencia_de);
                                if (!o) return "NC anterior vinculada";
                                return `Vinculada a ${o.codigo ?? "NC anterior"} — ${o.titulo}`;
                              })()}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {nc.obra_id ? (obraMap.get(nc.obra_id) ?? "—") : "—"}
                  </TableCell>
                  <TableCell>
                    <BadgeSeveridade severidade={nc.severidade} />
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusColor[nc.status]}>
                      {STATUS_LABEL[nc.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{nc.quando_planejado ?? "—"}</TableCell>
                  <TableCell className="text-sm">
                    {nc.quem ? (respMap.get(nc.quem) ?? "—") : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(nc);
                      }}
                    >
                      Abrir
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-destructive" />
                  {editing.codigo ?? "Nova NC"} — Tratativa
                </DialogTitle>
                <DialogDescription>
                  Preencha o 5W2H, registre ações corretivas/preventivas e anexe evidência para
                  fechar.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {editing.reincidencia_de &&
                  (() => {
                    const o = origemMap.get(editing.reincidencia_de);
                    return (
                      <div className="flex items-start gap-2 p-3 rounded-md border border-accent/40 bg-accent/10 text-sm">
                        <Repeat className="h-4 w-4 mt-0.5 text-accent-foreground shrink-0" />
                        <div>
                          <div className="font-medium text-foreground">NC reincidente</div>
                          <div className="text-muted-foreground">
                            Vinculada a {o?.codigo ?? "NC anterior"}
                            {o?.titulo ? ` — ${o.titulo}` : ""}
                            {o?.created_at ? ` (registrada em ${fmtDataLocal(o.created_at)})` : ""}.
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <Label>Título</Label>
                    <Input
                      value={editing.titulo}
                      onChange={(e) => patch("titulo", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Severidade</Label>
                    <Select
                      value={editing.severidade}
                      onValueChange={(v) => patch("severidade", v as NCSev)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="baixa">Baixa</SelectItem>
                        <SelectItem value="media">Média</SelectItem>
                        <SelectItem value="alta">Alta</SelectItem>
                        <SelectItem value="critica">Crítica</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Descrição</Label>
                  <Textarea
                    rows={2}
                    value={editing.descricao ?? ""}
                    onChange={(e) => patch("descricao", e.target.value)}
                  />
                </div>

                <div className="border rounded-md p-3 space-y-3 bg-muted/30">
                  <div className="text-sm font-semibold">5W2H</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">O quê (What)</Label>
                      <Textarea
                        rows={2}
                        value={editing.o_que ?? ""}
                        onChange={(e) => patch("o_que", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Por quê (Why)</Label>
                      <Textarea
                        rows={2}
                        value={editing.por_que ?? ""}
                        onChange={(e) => patch("por_que", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Onde (Where)</Label>
                      <Input
                        value={editing.onde ?? ""}
                        onChange={(e) => patch("onde", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Quando (When)</Label>
                      <DatePickerField
                        value={editing.quando_planejado ?? ""}
                        onChange={(v) => patch("quando_planejado", v || null)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Quem (Who)</Label>
                      <Select
                        value={editing.quem ?? "none"}
                        onValueChange={(v) => patch("quem", v === "none" ? null : v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— Não atribuído —</SelectItem>
                          {responsaveis.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.login || p.email || p.id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Como (How)</Label>
                      <Textarea
                        rows={2}
                        value={editing.como ?? ""}
                        onChange={(e) => patch("como", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Quanto (How much) — R$</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editing.quanto ?? ""}
                        onChange={(e) =>
                          patch("quanto", e.target.value === "" ? null : Number(e.target.value))
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Ação corretiva</Label>
                    <Textarea
                      rows={3}
                      value={editing.acao_corretiva ?? ""}
                      onChange={(e) => patch("acao_corretiva", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Ação preventiva</Label>
                    <Textarea
                      rows={3}
                      value={editing.acao_preventiva ?? ""}
                      onChange={(e) => patch("acao_preventiva", e.target.value)}
                    />
                  </div>
                </div>

                <div className="border rounded-md p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-1">
                      <ImageIcon className="h-4 w-4" /> Evidência
                    </Label>
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadEvidencia(f);
                        }}
                      />
                      <span className="inline-flex items-center gap-1 text-xs px-3 py-1.5 border rounded-md hover:bg-accent">
                        <Upload className="h-3 w-3" /> Enviar
                      </span>
                    </label>
                  </div>
                  {evidenciaUrl ? (
                    <div className="relative">
                      <img
                        src={evidenciaUrl}
                        alt="evidência"
                        className="max-h-64 rounded-md border"
                      />
                      <Button
                        size="sm"
                        variant="destructive"
                        className="absolute top-2 right-2 h-7 w-7 p-0"
                        onClick={() => {
                          patch("evidencia_path", null);
                          setEvidenciaUrl(null);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">
                      Nenhuma evidência anexada. Obrigatória para fechar a NC.
                    </div>
                  )}
                </div>

                <div className="border rounded-md p-3 space-y-3 bg-muted/30">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="text-sm font-semibold">Fluxo de tratativa</div>
                    <Badge variant="outline" className={statusColor[fsm?.status ?? editing.status]}>
                      {STATUS_LABEL[fsm?.status ?? editing.status] ?? "—"}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Ações formais do workflow (PRO-007). Alterações em <b>Quem</b>, <b>Quando</b> e
                    <b> Como</b> alimentam a transição selecionada.
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(fsm?.status === "aberta" || fsm?.status === "em_tratativa") && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (!editing.quem) {
                            toast.error("Selecione o responsável (Quem)");
                            return;
                          }
                          if (!editing.quando_planejado) {
                            toast.error("Informe o prazo (Quando)");
                            return;
                          }
                          runTransition(
                            {
                              type: "atribuir",
                              responsavelId: editing.quem,
                              prazoISO: new Date(editing.quando_planejado).toISOString(),
                              nowISO: new Date().toISOString(),
                            },
                            "Responsável e prazo atribuídos",
                          );
                        }}
                      >
                        Atribuir responsável
                      </Button>
                    )}
                    {fsm?.status === "em_tratativa" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const tratativa = editing.como || editing.acao_corretiva || "";
                          if (!tratativa.trim()) {
                            toast.error("Preencha a tratativa (Como) ou ação corretiva");
                            return;
                          }
                          runTransition(
                            {
                              type: "registrar_tratativa",
                              tratativa,
                              nowISO: new Date().toISOString(),
                            },
                            "Tratativa registrada",
                          );
                        }}
                      >
                        Registrar tratativa
                      </Button>
                    )}
                    {fsm?.status === "em_tratativa" && !!fsm.tratativa && (
                      <Button
                        size="sm"
                        onClick={() =>
                          runTransition(
                            { type: "solicitar_reinspecao", nowISO: new Date().toISOString() },
                            "Reinspeção solicitada",
                          )
                        }
                      >
                        Solicitar reinspeção
                      </Button>
                    )}
                    {fsm?.status === "aguardando_reinspecao" && (
                      <>
                        <Button
                          size="sm"
                          onClick={() =>
                            runTransition(
                              {
                                type: "reinspecionar",
                                resultado: "aprovada",
                                nowISO: new Date().toISOString(),
                              },
                              "Reinspeção aprovada — NC resolvida",
                            )
                          }
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" /> Aprovar reinspeção
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            runTransition(
                              {
                                type: "reinspecionar",
                                resultado: "reprovada",
                                nowISO: new Date().toISOString(),
                              },
                              "Reinspeção reprovada — retornou para tratativa",
                            )
                          }
                        >
                          Reprovar reinspeção
                        </Button>
                      </>
                    )}
                    {fsm && !["resolvida", "cancelada"].includes(fsm.status) && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          const motivo = window.prompt("Motivo do cancelamento:") ?? "";
                          if (!motivo.trim()) return;
                          runTransition(
                            { type: "cancelar", motivo, nowISO: new Date().toISOString() },
                            "NC cancelada",
                          );
                        }}
                      >
                        <X className="h-4 w-4 mr-1" /> Cancelar NC
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-2">
                <Button variant="outline" onClick={() => setEditing(null)}>
                  Cancelar
                </Button>
                <Button variant="secondary" onClick={() => salvar()}>
                  Salvar
                </Button>
                <Button
                  onClick={() => salvar("resolvida")}
                  disabled={!podeFechar}
                  title={!podeFechar ? "Preencha a ação corretiva e anexe evidência" : ""}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Fechar NC
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
