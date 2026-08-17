/**
 * Dialog "Adicionar recurso" — disparado a partir de uma linha do cronograma.
 *
 * Permite criar **um ou vários** recursos para a mesma atividade em uma
 * única chamada. Campos compartilhados (tipo, local, subsetor,
 * especificação geral) ficam no topo; cada item é uma linha da tabela
 * abaixo (Item · Descrição · Qtd · Un.).
 *
 * Cada linha vira um `cards` + `card_recursos` + `card_setores` (Compras
 * sempre; Producao se manufaturado). Os prazos são calculados uma vez
 * (cascata do `lead_time_templates`) e replicados em todas as linhas, pois
 * dependem apenas de `tipo` e `item.data_inicio`.
 *
 * TODO(perm): gate provisório é obras_div (editar) — trocar quando o modelo
 * de setores existir.
 */

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Trash2 } from "lucide-react";

import {
  leadTimeTemplatesRepo,
} from "@/lib/repositories/cardsExtra";
import { useInsertCard, useInsertCardSetores, useInsertCardRecurso } from "@/hooks/quadros/useCards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { useAuth } from "@/contexts/auth/useAuth";

import {
  calcularPrazos,
  type LeadTimeTemplate,
  type PrazosCalculados,
  type TipoRecurso,
} from "@/lib/recursos/lead-times";

type Subsetor = "Solda" | "Corte" | "Dobra";
type LocalEntrega = "obra" | "almoxarifado" | "outro";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  obraId: string;
  /** linha do cronograma (cronograma_itens). */
  item: { id: string; descricao?: string; data_inicio: string };
}

interface Linha {
  id: string;
  item: string;
  descricao: string;
  quantidade: string;
  unidade: string;
}

const TIPO_LABEL: Record<TipoRecurso, string> = {
  material_pronto: "Material pronto",
  manufaturado: "Material manufaturado",
  servico: "Serviço",
  equipamento: "Equipamento",
};

function fmt(iso?: string) {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return iso;
  }
}

function novaLinha(seed?: Partial<Linha>): Linha {
  return {
    id: crypto.randomUUID(),
    item: "",
    descricao: "",
    quantidade: "",
    unidade: "",
    ...seed,
  };
}

export function AdicionarRecursoDialog({ open, onOpenChange, obraId, item }: Props) {
  const qc = useQueryClient();
  const insertCardMut = useInsertCard();
  const insertCardSetoresMut = useInsertCardSetores();
  const insertCardRecursoMut = useInsertCardRecurso();
  const { currentPlayer } = useAuth();

  const [tipo, setTipo] = useState<TipoRecurso>("material_pronto");
  const [local, setLocal] = useState<LocalEntrega>("obra");
  const [subsetor, setSubsetor] = useState<Subsetor | "">("");
  const [especificacaoGeral, setEspecificacaoGeral] = useState("");
  const [linhas, setLinhas] = useState<Linha[]>([novaLinha()]);
  const [saving, setSaving] = useState(false);

  // reset ao abrir
  useEffect(() => {
    if (open) {
      setTipo("material_pronto");
      setLocal("obra");
      setSubsetor("");
      setEspecificacaoGeral("");
      setLinhas([novaLinha({ descricao: item.descricao ?? "" })]);
    }
  }, [open, item.descricao]);

  // Templates: override por obra > global
  const { data: templates } = useQuery({
    queryKey: ["lead-time-templates", obraId],
    enabled: open,
    queryFn: async () => await leadTimeTemplatesRepo.listPorObraOuGlobal(obraId),
  });

  const template = useMemo<LeadTimeTemplate | null>(() => {
    if (!templates) return null;
    const obraTpl = templates.find((t: any) => t.tipo_recurso === tipo && t.obra_id === obraId);
    const globalTpl = templates.find((t: any) => t.tipo_recurso === tipo && t.obra_id === null);
    const row = obraTpl ?? globalTpl;
    if (!row) return null;
    return {
      tipoRecurso: row.tipo_recurso as TipoRecurso,
      diasNecessidade: row.dias_necessidade,
      diasPedido: row.dias_pedido,
      diasNotifCompras: row.dias_notif_compras,
      diasProdIniciar: row.dias_prod_iniciar,
      diasNotifProducao: row.dias_notif_producao,
    };
  }, [templates, tipo, obraId]);

  const prazos = useMemo<PrazosCalculados | null>(() => {
    if (!template || !item.data_inicio) return null;
    try {
      return calcularPrazos(item.data_inicio, template);
    } catch {
      return null;
    }
  }, [template, item.data_inicio]);

  function atualizarLinha(id: string, patch: Partial<Linha>) {
    setLinhas((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }
  function removerLinha(id: string) {
    setLinhas((prev) => (prev.length === 1 ? prev : prev.filter((l) => l.id !== id)));
  }
  function adicionarLinha() {
    setLinhas((prev) => [...prev, novaLinha()]);
  }

  async function handleSalvar() {
    if (!prazos || !template) {
      toast.error("Template de prazos não encontrado para este tipo.");
      return;
    }
    const validas = linhas.filter((l) => l.descricao.trim());
    if (validas.length === 0) {
      toast.error("Adicione pelo menos um item com descrição.");
      return;
    }
    setSaving(true);
    const autor = (currentPlayer as any)?.nome ?? currentPlayer?.id ?? "";
    let criados = 0;
    try {
      for (const l of validas) {
        const titulo = l.item.trim()
          ? `${l.item.trim()} — ${l.descricao.trim()}`
          : l.descricao.trim();

        // 1) cards
        const { data: card, error: e1 } = await insertCardMut.mutateAsync({
          tipo: "recurso",
          titulo,
          status: "identificado",
          obra_id: obraId,
          cronograma_item_id: item.id,
          criado_por: autor,
        });
        if (e1) throw e1;

        // 2) card_recursos
        const { error: e2 } = await insertCardRecursoMut.mutateAsync({
          card_id: card.id,
          tipo_recurso: tipo,
          quantidade: l.quantidade ? Number(l.quantidade) : null,
          unidade: l.unidade || null,
          especificacao: especificacaoGeral || null,
          local_entrega: local,
          data_inicio_atividade: item.data_inicio,
          data_necessidade_obra: prazos.dataNecessidadeObra,
          prazo_notif_compras: prazos.prazoNotifCompras,
          prazo_pedido: prazos.prazoPedido,
          prazo_prod_iniciar: prazos.prazoProdIniciar ?? null,
          prazo_notif_producao: prazos.prazoNotifProducao ?? null,
        });
        if (e2) throw e2;

        // 3) card_setores
        const setores: Array<{
          card_id: string;
          setor: string;
          subsetor?: string | null;
          status_setor?: string | null;
        }> = [{ card_id: card.id, setor: "Compras", status_setor: "identificado" }];
        if (tipo === "manufaturado") {
          setores.push({
            card_id: card.id,
            setor: "Producao",
            subsetor: subsetor || null,
            status_setor: "aguardando_material",
          });
        }
        const { error: e3 } = await insertCardSetoresMut.mutateAsync(setores);
        if (e3) throw e3;

        criados += 1;
      }
      toast.success(
        `${criados} recurso${criados === 1 ? "" : "s"} adicionado${criados === 1 ? "" : "s"}.`,
      );
      qc.invalidateQueries({ queryKey: ["crono", obraId] });
      qc.invalidateQueries({ queryKey: ["cards", obraId] });
      qc.invalidateQueries({ queryKey: ["kanban-cards"] });
      onOpenChange(false);
    } catch (err: any) {
      if (criados > 0) {
        toast.error(
          `${criados} de ${validas.length} criado(s). Erro: ${err?.message ?? "Falha ao salvar"}`,
        );
        qc.invalidateQueries({ queryKey: ["crono", obraId] });
        qc.invalidateQueries({ queryKey: ["cards", obraId] });
      } else {
        toast.error(err?.message ?? "Falha ao salvar recurso");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar recursos à atividade</DialogTitle>
          <DialogDescription className="line-clamp-1">
            {item.descricao ?? "Atividade"} · início {fmt(item.data_inicio)}
          </DialogDescription>
        </DialogHeader>

        {/* Cabeçalho compartilhado */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Tipo de recurso</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoRecurso)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TIPO_LABEL) as TipoRecurso[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {TIPO_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Local de entrega</Label>
            <Select value={local} onValueChange={(v) => setLocal(v as LocalEntrega)}>
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

          {tipo === "manufaturado" && (
            <div className="col-span-2">
              <Label>Subsetor de produção (opcional)</Label>
              <Select value={subsetor} onValueChange={(v) => setSubsetor(v as Subsetor)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Solda">Solda</SelectItem>
                  <SelectItem value="Corte">Corte</SelectItem>
                  <SelectItem value="Dobra">Dobra</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="col-span-2">
            <Label>Especificação técnica (compartilhada)</Label>
            <Textarea
              rows={2}
              value={especificacaoGeral}
              onChange={(e) => setEspecificacaoGeral(e.target.value)}
              placeholder="Normas, fornecedor preferencial, observações…"
            />
          </div>
        </div>

        {/* Tabela de itens */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Itens</Label>
            <Button type="button" size="sm" variant="outline" onClick={adicionarLinha}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar linha
            </Button>
          </div>
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs">
                <tr>
                  <th className="text-left font-medium px-2 py-1.5 w-[22%]">Item</th>
                  <th className="text-left font-medium px-2 py-1.5">Descrição</th>
                  <th className="text-left font-medium px-2 py-1.5 w-[14%]">Qtd</th>
                  <th className="text-left font-medium px-2 py-1.5 w-[14%]">Un.</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.id} className="border-t">
                    <td className="px-1.5 py-1.5">
                      <Input
                        value={l.item}
                        onChange={(e) => atualizarLinha(l.id, { item: e.target.value })}
                        placeholder="Ex.: Perfil U 100"
                        className="h-8"
                      />
                    </td>
                    <td className="px-1.5 py-1.5">
                      <Input
                        value={l.descricao}
                        onChange={(e) => atualizarLinha(l.id, { descricao: e.target.value })}
                        placeholder="Ex.: 100x50x3mm — 12m"
                        className="h-8"
                      />
                    </td>
                    <td className="px-1.5 py-1.5">
                      <Input
                        type="number"
                        inputMode="decimal"
                        value={l.quantidade}
                        onChange={(e) => atualizarLinha(l.id, { quantidade: e.target.value })}
                        className="h-8"
                      />
                    </td>
                    <td className="px-1.5 py-1.5">
                      <Input
                        value={l.unidade}
                        onChange={(e) => atualizarLinha(l.id, { unidade: e.target.value })}
                        placeholder="un, m, kg"
                        className="h-8"
                      />
                    </td>
                    <td className="px-1 py-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => removerLinha(l.id)}
                        disabled={linhas.length === 1}
                        title="Remover linha"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Prévia da cascata */}
        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          {!template ? (
            <p className="text-muted-foreground">Carregando template de prazos…</p>
          ) : !prazos ? (
            <p className="text-destructive">
              Não foi possível calcular os prazos para esta atividade.
            </p>
          ) : tipo === "manufaturado" ? (
            <p className="leading-relaxed">
              Cada item precisa estar na obra até <b>{fmt(prazos.dataNecessidadeObra)}</b>. A
              produção deve começar em <b>{fmt(prazos.prazoProdIniciar)}</b> (Produção notificada em{" "}
              <b>{fmt(prazos.prazoNotifProducao)}</b>). O pedido deve ser fechado até{" "}
              <b>{fmt(prazos.prazoPedido)}</b> e Compras será notificado em{" "}
              <b>{fmt(prazos.prazoNotifCompras)}</b>.
            </p>
          ) : (
            <p className="leading-relaxed">
              Cada item precisa estar disponível até <b>{fmt(prazos.dataNecessidadeObra)}</b>.
              Compras será notificado em <b>{fmt(prazos.prazoNotifCompras)}</b> e o pedido deve ser
              fechado até <b>{fmt(prazos.prazoPedido)}</b>.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={saving || !prazos}>
            {saving
              ? "Salvando…"
              : `Adicionar ${linhas.filter((l) => l.descricao.trim()).length || ""} recurso(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
