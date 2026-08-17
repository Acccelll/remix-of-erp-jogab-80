/**
 * CRUD de grupos de negociação (rótulos compartilhados entre cards).
 * Renomear cascateia naturalmente (id permanece). Remover só é permitido
 * se nenhum card estiver vinculado.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, Check, X, Tags } from "lucide-react";
import { QueryState } from "@/components/common/QueryState";
import { EmptyState } from "@/components/common/EmptyState";

import { suprimentosRepo } from "@/lib/repositories/suprimentos";
import { useAuth } from "@/contexts/auth/useAuth";
import { useUserSetores } from "@/hooks/quadros/useCardPermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { confirmDialog } from "@/lib/ui/confirm";

interface Linha {
  id: string;
  rotulo: string;
  qtd: number;
}

export default function GruposNegociacao() {
  const qc = useQueryClient();
  const { currentPlayer } = useAuth();
  const { data: meusSetores = [] } = useUserSetores();
  const canEdit = !!currentPlayer?.isGM || meusSetores.includes("Compras");
  const [novo, setNovo] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [valorEdit, setValorEdit] = useState("");

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["grupos-negociacao-cnt"],
    queryFn: async (): Promise<Linha[]> => {
      const [gs, cs] = await Promise.all([
        suprimentosRepo.listGruposNegociacao(),
        suprimentosRepo.listCardsGrupoNegociacao(),
      ]);
      const cnt = new Map<string, number>();
      for (const c of cs ?? []) {
        if (!c.grupo_negociacao_id) continue;
        cnt.set(c.grupo_negociacao_id, (cnt.get(c.grupo_negociacao_id) ?? 0) + 1);
      }
      return (gs ?? []).map((g: any) => ({ id: g.id, rotulo: g.rotulo, qtd: cnt.get(g.id) ?? 0 }));
    },
  });

  function invalidar() {
    qc.invalidateQueries({ queryKey: ["grupos-negociacao-cnt"] });
    qc.invalidateQueries({ queryKey: ["grupos-negociacao"] });
    qc.invalidateQueries({ queryKey: ["kanban-cards"] });
  }

  async function criar() {
    const nome = novo.trim();
    if (!nome) return;
    try {
      await suprimentosRepo.createGrupoNegociacao(nome);
    } catch {
      return toast.error("Falha ao criar grupo");
    }
    setNovo("");
    invalidar();
  }

  async function renomear(id: string) {
    const nome = valorEdit.trim();
    if (!nome) return;
    try {
      await suprimentosRepo.renameGrupoNegociacao(id, nome);
    } catch {
      return toast.error("Falha ao renomear");
    }
    setEditando(null);
    invalidar();
  }

  async function remover(linha: Linha) {
    if (linha.qtd > 0) {
      toast.error(`Remova os ${linha.qtd} card(s) deste grupo antes`);
      return;
    }
    if (!(await confirmDialog({ title: `Remover o grupo "${linha.rotulo}"?`, description: "Esta ação não pode ser desfeita." }))) return;
    try {
      await suprimentosRepo.deleteGrupoNegociacao(linha.id);
    } catch {
      return toast.error("Falha ao remover");
    }
    invalidar();
  }

  return (
    <div className="p-6 space-y-4 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Grupos de Negociação</h1>
        <p className="text-sm text-muted-foreground">
          Rótulos compartilhados para agrupar cards de recurso correlatos (mesma cotação, mesmo
          fornecedor).
        </p>
      </div>

      {!canEdit && (
        <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
          Modo somente leitura — apenas usuários do setor Compras podem criar ou editar grupos.
        </div>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <fieldset disabled={!canEdit} className="contents disabled:opacity-100">
            <div className="flex gap-2">
              <Input
                value={novo}
                onChange={(e) => setNovo(e.target.value)}
                placeholder="Ex.: Cotação aço — Junho/26"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    criar();
                  }
                }}
              />
              <Button onClick={criar} disabled={!novo.trim()}>
                <Plus className="h-4 w-4" /> Novo grupo
              </Button>
            </div>

            <QueryState
              isLoading={isLoading}
              isError={isError}
              error={error}
              data={data ?? []}
              isEmpty={(d) => d.length === 0}
              onRetry={() => refetch()}
              empty={
                <EmptyState
                  icon={Tags}
                  title="Nenhum grupo cadastrado"
                  description="Crie o primeiro grupo para agrupar cards em negociação."
                />
              }
            >
              {(list) => (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rótulo</TableHead>
                      <TableHead className="w-28 text-right">Cards</TableHead>
                      <TableHead className="w-32 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.map((g) => (
                      <TableRow key={g.id}>
                        <TableCell>
                          {editando === g.id ? (
                            <Input
                              value={valorEdit}
                              onChange={(e) => setValorEdit(e.target.value)}
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") renomear(g.id);
                                if (e.key === "Escape") setEditando(null);
                              }}
                            />
                          ) : (
                            g.rotulo
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary">{g.qtd}</Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          {editando === g.id ? (
                            <>
                              <Button size="icon" variant="ghost" aria-label="Confirmar renomeação" onClick={() => renomear(g.id)}>
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" aria-label="Cancelar renomeação" onClick={() => setEditando(null)}>
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="icon"
                                aria-label="Renomear grupo"
                                variant="ghost"
                                onClick={() => {
                                  setEditando(g.id);
                                  setValorEdit(g.rotulo);
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                aria-label="Excluir grupo"
                                variant="ghost"
                                onClick={() => remover(g)}
                                disabled={g.qtd > 0}
                                title={g.qtd > 0 ? "Há cards vinculados" : "Remover"}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </QueryState>
          </fieldset>
        </CardContent>
      </Card>
    </div>
  );
}
