/**
 * Tela completa do card de recurso — espelha o layout do Trello (anexos do
 * prompt da Fase 4).
 *
 * Layout 2 colunas:
 *  - Esquerda: status, título+#numero, datas/prazos editáveis, descrição,
 *    campos personalizados (tipo/qty/un./local/manufaturado), anexos,
 *    checklist.
 *  - Direita: atividade (caixa de comentário + timeline).
 *
 * Regras:
 *  - status global respeita opcoesStatus(tipo, atual) — manufaturado é
 *    derivado e somente leitura aqui; trilhos editáveis abaixo.
 *  - editar prazo é permitido e NÃO dispara recálculo.
 *  - valor_oc é editado aqui; o efeito no "Custo Comprometido" é tratado
 *    na Fase 6 (função pura em committed-cost.ts).
 */

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Paperclip,
  CheckSquare,
  MessageSquare,
  Trash2,
  Upload,
  Loader2,
  ListChecks,
} from "lucide-react";

import { cardsQueryFns, useInsertCardAnexo, useInsertCardComentario, useInsertChecklistItem, useRemoveCardAnexo, useRemoveChecklistItem, useSetChecklistItemConcluido, useUpdateCard, useUpdateCardSetorStatus, useUpdateCardRecursoByCard, useUpdateCardById } from "@/hooks/quadros/useCards";
import { cardAnexosStorage } from "@/lib/repositories/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/auth/useAuth";
import { GrupoNegociacaoSelect } from "@/components/cards/GrupoNegociacaoSelect";

import {
  opcoesStatus,
  calcularStatusGlobalManufaturado,
  proximosStatusCompras,
  proximosStatusProducaoComDependencia,
  type StatusCompras,
  type StatusProducao,
  type StatusSimples,
} from "@/lib/recursos/status-card";
import type { TipoRecurso } from "@/lib/recursos/lead-times";
import { AlertTriangle } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cardId: string;
}

import { STATUS_RECURSO_LABEL as STATUS_LABEL } from "@/lib/status";

function fmtDt(iso?: string | null) {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return iso;
  }
}

export function CardRecursoDialog({ open, onOpenChange, cardId }: Props) {
  const qc = useQueryClient();
  const updateCardMut = useUpdateCard();
  const updateSetorStatusMut = useUpdateCardSetorStatus();
  const updateCardByIdMut = useUpdateCardById();
  const updateRecursoMut = useUpdateCardRecursoByCard();
  const insertChecklistItemMut = useInsertChecklistItem();
  const setChecklistConcluidoMut = useSetChecklistItemConcluido();
  const removeChecklistItemMut = useRemoveChecklistItem();
  const insertCardAnexoMut = useInsertCardAnexo();
  const removeCardAnexoMut = useRemoveCardAnexo();
  const insertCardComentarioMut = useInsertCardComentario();
  const { currentPlayer } = useAuth();
  const autor = (currentPlayer as any)?.nome ?? currentPlayer?.id ?? "";

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["card", cardId],
    enabled: open,
    queryFn: async () => {
      const [c, r, s, com, ch, an] = await Promise.all([
        cardsQueryFns.getCardFull(cardId),
        cardsQueryFns.getRecursoByCard(cardId),
        cardsQueryFns.listSetoresByCard(cardId).then((data) => ({ data, error: null as any })),
        cardsQueryFns.listComentariosByCardFull(cardId).then((data) => ({ data, error: null as any })),
        cardsQueryFns.listChecklistByCard(cardId).then((data) => ({ data, error: null as any })),
        cardsQueryFns.listAnexosByCard(cardId).then((data) => ({ data, error: null as any })),
      ]);
      if (c.error) throw c.error;
      return {
        card: c.data,
        recurso: r.data,
        setores: s.data ?? [],
        comentarios: com.data ?? [],
        checklist: ch.data ?? [],
        anexos: an.data ?? [],
      };
    },
  });

  const card = data?.card;
  const recurso = data?.recurso;
  const setores = data?.setores ?? [];
  const tipo = (recurso?.tipo_recurso ?? "material_pronto") as TipoRecurso;

  const trilhoCompras = setores.find((s: any) => s.setor === "Compras");
  const trilhoProducao = setores.find((s: any) => s.setor === "Producao");

  // status global (somente leitura para manufaturado)
  const statusGlobalDerivado = useMemo(() => {
    if (tipo !== "manufaturado") return card?.status as StatusSimples | undefined;
    return calcularStatusGlobalManufaturado(
      trilhoCompras?.status_setor as StatusCompras | undefined,
      trilhoProducao?.status_setor as StatusProducao | undefined,
    );
  }, [tipo, card?.status, trilhoCompras?.status_setor, trilhoProducao?.status_setor]);

  // ---------- mutações utilitárias ----------
  async function atualizarCard(patch: Record<string, any>) {
    const { error } = await updateCardByIdMut.mutateAsync({ cardId, patch });
    if (error) throw error;
    refetch();
    qc.invalidateQueries({ queryKey: ["crono", card?.obra_id] });
  }
  async function atualizarRecurso(patch: Record<string, any>) {
    const { error } = await updateRecursoMut.mutateAsync({ cardId, patch });
    if (error) throw error;
    refetch();
  }
  async function atualizarTrilho(setor: "Compras" | "Producao", status_setor: string) {
    const { error } = await updateSetorStatusMut.mutateAsync({ cardId, setor, statusSetor: status_setor });
    if (error) throw error;
    // se manufaturado, recalcula status global
    if (tipo === "manufaturado") {
      const c =
        setor === "Compras"
          ? (status_setor as StatusCompras)
          : (trilhoCompras?.status_setor as StatusCompras);
      const p =
        setor === "Producao"
          ? (status_setor as StatusProducao)
          : (trilhoProducao?.status_setor as StatusProducao);
      const novoGlobal = calcularStatusGlobalManufaturado(c, p);
      await updateCardMut.mutateAsync({ id: cardId, patch: { status: novoGlobal } as any });
    }
    refetch();
    qc.invalidateQueries({ queryKey: ["crono", card?.obra_id] });
  }

  // ---------- comentários ----------
  const [novoComent, setNovoComent] = useState("");
  async function adicionarComentario() {
    if (!novoComent.trim()) return;
    const { error } = await insertCardComentarioMut.mutateAsync({
      cardId,
      payload: {
        card_id: cardId,
        autor,
        texto: novoComent.trim(),
      },
    });
    if (error) return toast.error(error.message);
    setNovoComent("");
    refetch();
  }

  async function solicitarAtualizacaoCompras() {
    const statusAtual =
      STATUS_LABEL[trilhoCompras?.status_setor ?? ""] ?? trilhoCompras?.status_setor ?? "—";
    const texto = `Produção solicita atualização de status ao Compras — aguardando avanço (status atual de Compras: ${statusAtual}).`;
    const { error } = await insertCardComentarioMut.mutateAsync({ cardId, payload: { card_id: cardId, autor, texto } });
    if (error) return toast.error(error.message);
    toast.success("Solicitação enviada ao Compras");
    refetch();
    qc.invalidateQueries({ queryKey: ["kanban-cards"] });
  }

  // ---------- checklist ----------
  const [novoCheck, setNovoCheck] = useState("");
  async function addCheck() {
    if (!novoCheck.trim()) return;
    const ordem = (data?.checklist?.length ?? 0) + 1;
    const { error } = await insertChecklistItemMut.mutateAsync({
      cardId,
      payload: {
        card_id: cardId,
        texto: novoCheck.trim(),
        ordem,
      },
    });
    if (error) return toast.error(error.message);
    setNovoCheck("");
    refetch();
  }
  async function toggleCheck(id: string, concluido: boolean) {
    await setChecklistConcluidoMut.mutateAsync({ id, concluido, cardId });
    refetch();
  }
  async function removeCheck(id: string) {
    await removeChecklistItemMut.mutateAsync({ id, cardId });
    refetch();
  }
  const checklistProgress = useMemo(() => {
    const total = data?.checklist?.length ?? 0;
    if (!total) return 0;
    const done = data!.checklist.filter((c: any) => c.concluido).length;
    return Math.round((done / total) * 100);
  }, [data?.checklist]);

  // ---------- anexos ----------
  const [uploading, setUploading] = useState(false);
  async function uploadAnexo(file: File) {
    setUploading(true);
    try {
      const path = `${cardId}/${Date.now()}-${file.name}`;
      const up = await cardAnexosStorage.upload(path, file);
      if (up.error) throw up.error;
      const { error } = await insertCardAnexoMut.mutateAsync({
        cardId,
        payload: {
          card_id: cardId,
          nome: file.name,
          storage_path: path,
          tamanho: file.size,
          mime: file.type,
          enviado_por: autor,
        },
      });
      if (error) throw error;
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao enviar anexo");
    } finally {
      setUploading(false);
    }
  }
  async function baixarAnexo(path: string, nome: string) {
    const { data: blob, error } = await cardAnexosStorage.download(path);
    if (error) return toast.error(error.message);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nome;
    a.click();
    URL.revokeObjectURL(url);
  }
  async function removerAnexo(id: string, path: string) {
    await cardAnexosStorage.remove([path]);
    await removeCardAnexoMut.mutateAsync({ id, cardId });
    refetch();
  }

  // ---------- render ----------
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2">
            <span className="text-muted-foreground font-mono text-sm">#{card?.numero ?? "—"}</span>
            <Input
              value={card?.titulo ?? ""}
              onChange={(e) => atualizarCard({ titulo: e.target.value }).catch(() => {})}
              className="border-0 shadow-none focus-visible:ring-0 text-lg font-semibold px-0 h-auto"
              placeholder="Título do card"
            />
          </DialogTitle>
        </DialogHeader>

        {isLoading || !card ? (
          <div className="p-12 text-center text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-6 px-6 py-4 overflow-y-auto max-h-[calc(90vh-80px)]">
            {/* ============== COLUNA ESQUERDA (2/3) ============== */}
            <div className="col-span-2 space-y-5">
              {/* Status */}
              <div className="flex items-center gap-3">
                <Label className="w-24">Status</Label>
                {tipo === "manufaturado" ? (
                  <Badge variant="outline" className="text-sm">
                    {STATUS_LABEL[statusGlobalDerivado ?? ""] ?? statusGlobalDerivado}
                    <span className="ml-2 text-[10px] text-muted-foreground">(derivado)</span>
                  </Badge>
                ) : (
                  <Select
                    value={card.status}
                    onValueChange={(v) =>
                      atualizarCard({ status: v }).catch((e) => toast.error(e.message))
                    }
                  >
                    <SelectTrigger className="w-60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {opcoesStatus(tipo, card.status as StatusSimples).map((s) => (
                        <SelectItem key={s} value={s}>
                          {STATUS_LABEL[s] ?? s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Trilhos do manufaturado */}
              {tipo === "manufaturado" && (
                <div className="rounded-md border p-3 space-y-3 bg-muted/30">
                  <div className="text-xs font-semibold uppercase text-muted-foreground">
                    Trilhos (manufaturado)
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Compras</Label>
                      <Select
                        value={trilhoCompras?.status_setor ?? "identificado"}
                        onValueChange={(v) => atualizarTrilho("Compras", v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {proximosStatusCompras(
                            (trilhoCompras?.status_setor ?? "identificado") as StatusCompras,
                          ).map((s) => (
                            <SelectItem key={s} value={s}>
                              {STATUS_LABEL[s] ?? s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Produção</Label>
                      <Select
                        value={trilhoProducao?.status_setor ?? "aguardando_material"}
                        onValueChange={(v) => atualizarTrilho("Producao", v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {proximosStatusProducaoComDependencia(
                            (trilhoProducao?.status_setor ??
                              "aguardando_material") as StatusProducao,
                            trilhoCompras?.status_setor as StatusCompras | undefined,
                          ).map((s) => (
                            <SelectItem key={s} value={s}>
                              {STATUS_LABEL[s] ?? s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {trilhoCompras?.status_setor !== "materia_entregue" && (
                        <div className="mt-2 flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-2 text-[11px] text-warning-foreground">
                          <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                          <div className="flex-1">
                            Produção só avança quando Compras estiver em <b>Matéria entregue</b>.
                            <Button
                              type="button"
                              size="sm"
                              variant="link"
                              className="h-auto p-0 ml-1 text-[11px]"
                              onClick={() => solicitarAtualizacaoCompras()}
                            >
                              Solicitar atualização ao Compras
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Prazos (editáveis) */}
              {recurso && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase text-muted-foreground">Datas</div>
                  <div className="grid grid-cols-2 gap-3">
                    <DateField
                      label="Início da atividade"
                      value={recurso.data_inicio_atividade}
                      onChange={(v) => atualizarRecurso({ data_inicio_atividade: v })}
                    />
                    <DateField
                      label="Necessidade na obra"
                      value={recurso.data_necessidade_obra}
                      onChange={(v) => atualizarRecurso({ data_necessidade_obra: v })}
                    />
                    <DateField
                      label="Prazo do pedido"
                      value={recurso.prazo_pedido}
                      onChange={(v) => atualizarRecurso({ prazo_pedido: v })}
                    />
                    <DateField
                      label="Notif. Compras"
                      value={recurso.prazo_notif_compras}
                      onChange={(v) => atualizarRecurso({ prazo_notif_compras: v })}
                    />
                    {tipo === "manufaturado" && (
                      <>
                        <DateField
                          label="Início da produção"
                          value={recurso.prazo_prod_iniciar}
                          onChange={(v) => atualizarRecurso({ prazo_prod_iniciar: v })}
                        />
                        <DateField
                          label="Notif. Produção"
                          value={recurso.prazo_notif_producao}
                          onChange={(v) => atualizarRecurso({ prazo_notif_producao: v })}
                        />
                      </>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Editar prazos manualmente não dispara recálculo — você está reportando a
                    realidade.
                  </p>
                </div>
              )}

              {/* Descrição */}
              <div>
                <Label>Descrição</Label>
                <Textarea
                  rows={3}
                  value={card.descricao ?? ""}
                  onChange={(e) => atualizarCard({ descricao: e.target.value }).catch(() => {})}
                  placeholder="Detalhe a necessidade…"
                />
              </div>

              {/* Campos personalizados */}
              {recurso && (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Quantidade</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      defaultValue={recurso.quantidade ?? ""}
                      onBlur={(e) =>
                        atualizarRecurso({
                          quantidade: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Unidade</Label>
                    <Input
                      defaultValue={recurso.unidade ?? ""}
                      onBlur={(e) => atualizarRecurso({ unidade: e.target.value || null })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Local de entrega</Label>
                    <Select
                      value={recurso.local_entrega}
                      onValueChange={(v) => atualizarRecurso({ local_entrega: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="obra">Obra</SelectItem>
                        <SelectItem value="almoxarifado">Almoxarifado</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3">
                    <Label className="text-xs">Negociação</Label>
                    <GrupoNegociacaoSelect
                      value={card?.grupo_negociacao_id ?? null}
                      onChange={(id) => atualizarCard({ grupo_negociacao_id: id })}
                    />
                  </div>
                  <div className="col-span-3">
                    <Label className="text-xs">Especificação técnica</Label>
                    <Textarea
                      rows={2}
                      defaultValue={recurso.especificacao ?? ""}
                      onBlur={(e) => atualizarRecurso({ especificacao: e.target.value || null })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Valor estimado</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      defaultValue={recurso.valor_estimado ?? ""}
                      onBlur={(e) =>
                        atualizarRecurso({
                          valor_estimado: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">
                      Valor da OC <span className="text-muted-foreground">(committed cost)</span>
                    </Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      defaultValue={recurso.valor_oc ?? ""}
                      onBlur={(e) =>
                        atualizarRecurso({
                          valor_oc: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    />
                  </div>
                </div>
              )}

              {/* Anexos */}
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Paperclip className="h-4 w-4" /> Anexos
                  </Label>
                  <label className="inline-flex">
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && uploadAnexo(e.target.files[0])}
                    />
                    <Button asChild size="sm" variant="outline" disabled={uploading}>
                      <span className="cursor-pointer">
                        {uploading ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                        ) : (
                          <Upload className="h-3.5 w-3.5 mr-1" />
                        )}
                        Enviar
                      </span>
                    </Button>
                  </label>
                </div>
                {data!.anexos.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum anexo.</p>
                ) : (
                  <ul className="space-y-1">
                    {data!.anexos.map((a: any) => (
                      <li
                        key={a.id}
                        className="flex items-center gap-2 text-sm rounded border px-2 py-1"
                      >
                        <button
                          className="flex-1 text-left hover:underline truncate"
                          onClick={() => baixarAnexo(a.storage_path, a.nome)}
                        >
                          {a.nome}
                        </button>
                        <span className="text-xs text-muted-foreground">
                          {a.tamanho ? `${Math.round(a.tamanho / 1024)} KB` : ""}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removerAnexo(a.id, a.storage_path)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Checklist */}
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <ListChecks className="h-4 w-4" /> Checklist
                  </Label>
                  <span className="text-xs text-muted-foreground">{checklistProgress}%</span>
                </div>
                <Progress value={checklistProgress} className="h-1.5" />
                <ul className="space-y-1">
                  {data!.checklist.map((it: any) => (
                    <li key={it.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={it.concluido}
                        onCheckedChange={(v) => toggleCheck(it.id, Boolean(v))}
                      />
                      <span
                        className={
                          it.concluido ? "line-through text-muted-foreground flex-1" : "flex-1"
                        }
                      >
                        {it.texto}
                      </span>
                      <Button size="sm" variant="ghost" onClick={() => removeCheck(it.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <Input
                    placeholder="Novo item…"
                    value={novoCheck}
                    onChange={(e) => setNovoCheck(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addCheck()}
                  />
                  <Button size="sm" onClick={addCheck}>
                    <CheckSquare className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* ============== COLUNA DIREITA (1/3) ============== */}
            <div className="col-span-1 space-y-3">
              <Label className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Atividade
              </Label>
              <div className="space-y-2">
                <Textarea
                  rows={3}
                  placeholder="Escrever um comentário…"
                  value={novoComent}
                  onChange={(e) => setNovoComent(e.target.value)}
                />
                <Button
                  size="sm"
                  className="w-full"
                  onClick={adicionarComentario}
                  disabled={!novoComent.trim()}
                >
                  Comentar
                </Button>
              </div>
              <Separator />
              <ul className="space-y-3">
                {data!.comentarios.length === 0 ? (
                  <li className="text-xs text-muted-foreground">Sem comentários.</li>
                ) : (
                  data!.comentarios.map((c: any) => (
                    <li key={c.id} className="text-sm">
                      <div className="text-xs text-muted-foreground">
                        <b className="text-foreground">{c.autor || "—"}</b> · {fmtDt(c.created_at)}
                      </div>
                      <div className="mt-0.5 whitespace-pre-wrap">{c.texto}</div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        type="date"
        defaultValue={value ?? ""}
        onBlur={(e) => onChange(e.target.value || null)}
      />
    </div>
  );
}
