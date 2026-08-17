// Aba "Delegações" da página Funções — CRUD das subdivisões usadas pelo
// Histograma e atribuição das funções a cada delegação (funcoes.delegacao_id).
import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/common/EmptyState";
import { confirmDialog } from "@/lib/ui/confirm";
import { useDelegacoes, useSaveDelegacao, useDeleteDelegacao } from "@/hooks/rh/useDelegacoes";
import { useFuncoes, useSaveFuncao } from "@/hooks/rh/useFuncoes";
import type { Delegacao } from "@/types";

export function DelegacoesTab({ canEdit }: { canEdit: boolean }) {
  const { data: delegacoes = [] } = useDelegacoes();
  const { data: funcoes = [] } = useFuncoes();
  const saveDelegacao = useSaveDelegacao();
  const deleteDelegacao = useDeleteDelegacao();
  const saveFuncao = useSaveFuncao();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Delegacao | null>(null);
  const [nome, setNome] = useState("");
  const [funcoesSel, setFuncoesSel] = useState<Set<string>>(new Set());

  const funcoesAtivas = useMemo(() => funcoes.filter((f) => f.ativa), [funcoes]);
  const funcoesPorDelegacao = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const f of funcoes) {
      if (!f.delegacaoId) continue;
      map.set(f.delegacaoId, [...(map.get(f.delegacaoId) ?? []), f.nome]);
    }
    return map;
  }, [funcoes]);

  const openForm = (delegacao?: Delegacao) => {
    setEditing(delegacao ?? null);
    setNome(delegacao?.nome ?? "");
    setFuncoesSel(
      new Set(
        delegacao ? funcoes.filter((f) => f.delegacaoId === delegacao.id).map((f) => f.id) : [],
      ),
    );
    setFormOpen(true);
  };

  const handleSave = async () => {
    const clean = nome.trim();
    if (!clean) return;
    let delegacaoId = editing?.id;
    if (editing) {
      await saveDelegacao.mutateAsync({ id: editing.id, payload: { nome: clean } });
    } else {
      const result = (await saveDelegacao.mutateAsync({ payload: { nome: clean } })) as any;
      delegacaoId = result?.id ? String(result.id) : undefined;
    }
    // Sincroniza vínculos: marca as selecionadas, desmarca as removidas.
    if (delegacaoId) {
      for (const f of funcoes) {
        const selecionada = funcoesSel.has(f.id);
        const vinculada = f.delegacaoId === delegacaoId;
        if (selecionada && !vinculada) {
          saveFuncao.mutate({ id: f.id, payload: { delegacaoId } });
        } else if (!selecionada && vinculada) {
          saveFuncao.mutate({ id: f.id, payload: { delegacaoId: null } });
        }
      }
    }
    setFormOpen(false);
  };

  const handleDelete = async (d: Delegacao) => {
    const ok = await confirmDialog({
      title: `Remover a delegação "${d.nome}"?`,
      description: "As funções vinculadas ficam sem delegação (não são excluídas).",
    });
    if (ok) deleteDelegacao.mutate(d.id);
  };

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => openForm()}>
            <Plus className="h-4 w-4 mr-1" /> Nova Delegação
          </Button>
        </div>
      )}

      {delegacoes.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhuma delegação cadastrada."
          description="Crie delegações para agrupar funções na visualização do histograma."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {delegacoes.map((d) => {
            const nomes = funcoesPorDelegacao.get(d.id) ?? [];
            return (
              <Card key={d.id}>
                <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                  <span className="font-semibold">{d.nome}</span>
                  {canEdit && (
                    <span className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openForm(d)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => handleDelete(d)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </span>
                  )}
                </CardHeader>
                <CardContent className="pt-0">
                  {nomes.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhuma função vinculada.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {nomes.map((n) => (
                        <Badge key={n} variant="secondary" className="font-normal">
                          {n}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Delegação" : "Nova Delegação"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="delegacao-nome">Nome</Label>
              <Input
                id="delegacao-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder='Ex.: "Equipe Civil"'
              />
            </div>
            <div className="space-y-1.5">
              <Label>Funções desta delegação</Label>
              <div className="max-h-56 overflow-y-auto rounded-md border p-2 space-y-1.5">
                {funcoesAtivas.map((f) => {
                  const outra =
                    f.delegacaoId && f.delegacaoId !== editing?.id
                      ? delegacoes.find((d) => d.id === f.delegacaoId)?.nome
                      : null;
                  return (
                    <label key={f.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={funcoesSel.has(f.id)}
                        onCheckedChange={(v) => {
                          setFuncoesSel((prev) => {
                            const next = new Set(prev);
                            if (v) next.add(f.id);
                            else next.delete(f.id);
                            return next;
                          });
                        }}
                      />
                      <span className="flex-1 truncate">{f.nome}</span>
                      {outra ? (
                        <span className="text-[10px] text-muted-foreground">em {outra}</span>
                      ) : null}
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Marcar uma função já vinculada a outra delegação a transfere para esta.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!nome.trim()}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default DelegacoesTab;
