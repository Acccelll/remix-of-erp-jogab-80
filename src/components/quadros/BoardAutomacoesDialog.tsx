/**
 * PRO-027.slice-02 — Painel de gestão de automações do board.
 * ETAPA 1 — persistência no banco (`board_automacoes`), regra da equipe.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus, Zap } from "lucide-react";
import { toast } from "sonner";
import {
  presetsForTemplate,
  type Automacao,
  type AutomacaoAcao,
} from "@/lib/quadros/automacoes";

import { cardLabelsRepo } from "@/lib/repositories/cardsExtra";
import {
  toAutomacao,
  useBoardAutomacoes,
  useRemoveBoardAutomacao,
  useUpsertBoardAutomacao,
} from "@/hooks/quadros/useBoardAutomacoes";

interface Props {
  boardId: string;
  listas: { id: string; nome: string }[];
  templateId?: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}


type AcaoTipo = AutomacaoAcao["tipo"];

const novo = (boardId: string, listaId: string): Automacao => ({
  id: crypto.randomUUID(),
  boardId,
  ativa: true,
  nome: "Nova regra",
  gatilho: { tipo: "card_movido_para_lista", listaId },
  acoes: [{ tipo: "notificar", mensagem: "Card movido" }],
  criadaEm: new Date().toISOString(),
});

export default function BoardAutomacoesDialog({ boardId, listas, templateId, open, onOpenChange }: Props) {
  const [rows, setRows] = useState<Automacao[]>([]);
  const automacoes = useBoardAutomacoes(boardId, open);
  const upsertMut = useUpsertBoardAutomacao(boardId);
  const removeMut = useRemoveBoardAutomacao(boardId);
  const sincronizado = useRef(false);

  useEffect(() => {
    if (!open) {
      sincronizado.current = false;
      return;
    }
    if (sincronizado.current || !automacoes.data) return;
    sincronizado.current = true;
    setRows(automacoes.data.map(toAutomacao));
  }, [open, automacoes.data]);

  const { data: labels = [] } = useQuery({
    queryKey: ["card_labels", "resumo"],
    queryFn: () => cardLabelsRepo.listResumo(),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const labelMap = useMemo(
    () => new Map<string, string>(labels.map((l: any) => [l.id, l.nome])),
    [labels],
  );

  function persist(next: Automacao[]) {
    setRows(next);
  }

  function commit(a: Automacao) {
    upsertMut.mutate(
      {
        id: a.id,
        board_id: boardId,
        nome: a.nome,
        ativa: a.ativa,
        gatilho: a.gatilho,
        acoes: a.acoes,
      },
      { onError: (e) => toast.error(e.message ?? "Falha ao salvar automação") },
    );
  }

  function addRegra() {
    if (!listas.length) {
      toast.error("Crie ao menos uma lista antes de configurar automações.");
      return;
    }
    const n = novo(boardId, listas[0].id);
    persist([...rows, n]);
    commit(n);
  }

  function aplicarSugestoes() {
    if (!templateId) {
      toast.error("Este quadro não expõe template — use 'Nova regra'.");
      return;
    }
    const presets = presetsForTemplate(templateId);
    const listaDefault = listas[0]?.id ?? "";
    const materializadas: Automacao[] = presets.map((p) => {
      const gatilho =
        p.gatilho.tipo === "card_movido_para_lista" && !p.gatilho.listaId
          ? { tipo: "card_movido_para_lista" as const, listaId: listaDefault }
          : p.gatilho;
      return {
        ...p,
        gatilho,
        id: crypto.randomUUID(),
        boardId,
        criadaEm: new Date().toISOString(),
      };
    });
    for (const r of materializadas) commit(r);
    persist([...rows, ...materializadas]);
    toast.success(`${materializadas.length} regra(s) sugerida(s) aplicada(s).`);
  }


  function updateRegra(id: string, patch: Partial<Automacao>) {
    const next = rows.map((r) => (r.id === id ? { ...r, ...patch } : r));
    persist(next);
    const changed = next.find((r) => r.id === id);
    if (changed) commit(changed);
  }

  function updateAcao(id: string, tipo: AcaoTipo, extra: Partial<AutomacaoAcao> = {}) {
    const next = rows.map((r) => {
      if (r.id !== id) return r;
      const acao: AutomacaoAcao =
        tipo === "notificar"
          ? { tipo: "notificar", mensagem: (extra as any).mensagem ?? "Card movido" }
          : {
              tipo: "adicionar_label",
              labelId: (extra as any).labelId ?? (labels[0]?.id ?? ""),
              labelNome: labelMap.get((extra as any).labelId ?? labels[0]?.id ?? ""),
            };
      return { ...r, acoes: [acao] };
    });
    persist(next);
    const changed = next.find((r) => r.id === id);
    if (changed) commit(changed);
  }

  function removeRegra(id: string) {
    persist(rows.filter((r) => r.id !== id));
    removeMut.mutate(id, {
      onError: (e) => toast.error(e.message ?? "Falha ao remover automação"),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4" /> Automações do quadro
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhuma regra. Clique em "Nova regra" para criar automações que
              disparam quando um card entra em uma lista.
            </p>
          )}

          {rows.map((r) => {
            const acao = r.acoes[0];
            return (
              <div key={r.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    value={r.nome}
                    onChange={(e) => updateRegra(r.id, { nome: e.target.value })}
                    className="h-8"
                  />
                  <div className="flex items-center gap-1 text-xs">
                    <Switch
                      checked={r.ativa}
                      onCheckedChange={(v) => updateRegra(r.id, { ativa: !!v })}
                    />
                    <span>{r.ativa ? "Ativa" : "Pausada"}</span>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Remover regra"
                    title="Remover regra"
                    onClick={() => removeRegra(r.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                  <div>
                    <Label className="text-xs">Gatilho</Label>
                    <Select
                      value={r.gatilho.tipo}
                      onValueChange={(v) => {
                        if (v === "card_movido_para_lista") {
                          updateRegra(r.id, {
                            gatilho: {
                              tipo: "card_movido_para_lista",
                              listaId: listas[0]?.id ?? "",
                            },
                          });
                        } else {
                          updateRegra(r.id, {
                            gatilho: { tipo: "card_vencendo", diasAntes: 3 },
                          });
                        }
                      }}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="card_movido_para_lista">Card entra na lista…</SelectItem>
                        <SelectItem value="card_vencendo">Card vencendo em N dias</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {r.gatilho.tipo === "card_movido_para_lista" && (
                    <div>
                      <Label className="text-xs">Lista alvo</Label>
                      <Select
                        value={r.gatilho.listaId}
                        onValueChange={(v) =>
                          updateRegra(r.id, {
                            gatilho: { tipo: "card_movido_para_lista", listaId: v },
                          })
                        }
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {listas.map((l) => (
                            <SelectItem key={l.id} value={l.id}>
                              {l.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {r.gatilho.tipo === "card_vencendo" && (
                    <div>
                      <Label className="text-xs">Dias antes do vencimento</Label>
                      <Input
                        type="number"
                        min={0}
                        max={90}
                        className="h-8"
                        value={r.gatilho.diasAntes}
                        onChange={(e) =>
                          updateRegra(r.id, {
                            gatilho: {
                              tipo: "card_vencendo",
                              diasAntes: Math.max(0, Number(e.target.value) || 0),
                            },
                          })
                        }
                      />
                    </div>
                  )}


                  <div>
                    <Label className="text-xs">Ação</Label>
                    <Select
                      value={acao.tipo}
                      onValueChange={(v) => updateAcao(r.id, v as AcaoTipo)}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="notificar">Mostrar notificação</SelectItem>
                        <SelectItem value="adicionar_label">Adicionar etiqueta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {acao.tipo === "notificar" && (
                  <div>
                    <Label className="text-xs">Mensagem</Label>
                    <Input
                      value={acao.mensagem}
                      className="h-8"
                      onChange={(e) => updateAcao(r.id, "notificar", { mensagem: e.target.value })}
                    />
                  </div>
                )}

                {acao.tipo === "adicionar_label" && (
                  <div>
                    <Label className="text-xs">Etiqueta</Label>
                    <Select
                      value={acao.labelId}
                      onValueChange={(v) => updateAcao(r.id, "adicionar_label", { labelId: v })}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Escolher etiqueta" />
                      </SelectTrigger>
                      <SelectContent>
                        {labels.map((l: any) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between gap-2">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={addRegra}>
              <Plus className="h-4 w-4 mr-1" /> Nova regra
            </Button>
            {templateId && (
              <Button variant="outline" size="sm" onClick={aplicarSugestoes}>
                Aplicar sugestões
              </Button>
            )}
          </div>
          <Button size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}
