/**
 * /quadros — índice de quadros (setor / obra / custom).
 *
 * Fase B: lista quadros existentes (oriundos da Fase A) e permite criar
 * quadros custom. Arquivar/desarquivar via toggle. Cards seguem em pool
 * único — visibilidade é derivada via `card_board_posicao`.
 */
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  boardsKeys,
  boardsQueryFns,
  useCreateCustomBoard,
  useInsertBoardListas,
  useSetBoardArquivado,
  useToggleBoardFavorito,
} from "@/hooks/quadros/useBoards";
import { authRepo } from "@/lib/repositories/auth";
import { queryKey } from "@/lib/query-keys";
import { useAuth } from "@/contexts/auth/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Archive,
  ArchiveRestore,
  LayoutGrid,
  Building2,
  Briefcase,
  User,
  Star,
} from "lucide-react";
import { QueryState } from "@/components/common/QueryState";
import { listasDoTemplate, TEMPLATES_DISPONIVEIS, type TemplateId } from "@/lib/quadros/templates";

interface BoardRow {
  id: string;
  nome: string;
  tipo: "setor" | "obra" | "custom";
  setor: string | null;
  obra_id: string | null;
  arquivado: boolean;
  owner_id: string | null;
}

const TIPO_ICON = {
  setor: Briefcase,
  obra: Building2,
  custom: User,
} as const;

export default function Quadros() {
  const qc = useQueryClient();
  const { currentPlayer } = useAuth();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  // Compat: /quadros?view=meus → /quadros/meus
  useEffect(() => {
    if (searchParams.get("view") === "meus") nav("/quadros/meus", { replace: true });
  }, [searchParams, nav]);
  const [tab, setTab] = useState<
    "todos" | "favoritos" | "setor" | "obra" | "custom" | "arquivados"
  >("todos");
  const [novoOpen, setNovoOpen] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novoTemplate, setNovoTemplate] = useState<TemplateId>("generico");

  const createCustomBoardMut = useCreateCustomBoard();
  const insertBoardListasMut = useInsertBoardListas();
  const setBoardArquivadoMut = useSetBoardArquivado();

  // ETAPA 1 · favoritos por usuário (persistidos em `board_favoritos`).
  const userIdQ = useQuery({
    queryKey: queryKey("auth-user-id"),
    queryFn: () => authRepo.getUserId(),
    staleTime: 5 * 60 * 1000,
  });
  const userId = userIdQ.data ?? null;
  const favoritosQ = useQuery({
    queryKey: boardsKeys.favoritos(userId ?? "anon"),
    queryFn: () => boardsQueryFns.listFavoritos(userId as string),
    enabled: !!userId,
  });
  const favoritos = new Set(favoritosQ.data ?? []);
  const toggleFavoritoMut = useToggleBoardFavorito(userId);

  async function toggleFavorito(b: BoardRow) {
    try {
      await toggleFavoritoMut.mutateAsync({ boardId: b.id, favorito: !favoritos.has(b.id) });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao favoritar");
    }
  }

  const q = useQuery({
    queryKey: boardsKeys.index,
    queryFn: async (): Promise<BoardRow[]> => {
      return (await boardsQueryFns.listIndex()) as BoardRow[];
    },
  });

  async function criarCustom() {
    const nome = novoNome.trim();
    if (!nome) return;
    const session = await authRepo.getSession();
    const ownerId = session?.user?.id ?? (await authRepo.getUserId());
    if (!ownerId) {
      toast.error("Sessão não autenticada. Refaça o login para criar um quadro.");
      return;
    }
    let boardId: string;
    try {
      boardId = await createCustomBoardMut.mutateAsync({ nome, ownerId });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao criar");
      return;
    }

    // listas a partir do template selecionado
    const tmpl = listasDoTemplate(novoTemplate);
    await insertBoardListasMut.mutateAsync(
      tmpl.map((l) => ({
        board_id: boardId,
        nome: l.nome,
        posicao: l.posicao,
        wip_limite: l.wip_limite,
      })),
    );
    toast.success("Quadro criado");
    setNovoOpen(false);
    setNovoNome("");
    setNovoTemplate("generico");
    qc.invalidateQueries({ queryKey: boardsKeys.index });
  }

  async function toggleArquivar(b: BoardRow) {
    try {
      await setBoardArquivadoMut.mutateAsync({ id: b.id, arquivado: !b.arquivado });
    } catch (e: any) {
      return toast.error(e?.message ?? "Falha");
    }
  }

  const all = q.data ?? [];
  const filtrado = all
    .filter((b) => {
      if (tab === "arquivados") return b.arquivado;
      if (b.arquivado) return false;
      if (tab === "favoritos") return favoritos.has(b.id);
      if (tab === "todos") return true;
      return b.tipo === tab;
    })
    // favoritos primeiro, preservando a ordem vinda do banco
    .sort((a, b) => Number(favoritos.has(b.id)) - Number(favoritos.has(a.id)));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <LayoutGrid className="h-6 w-6 text-primary" /> Kanban
          </h1>
          <p className="text-sm text-muted-foreground">
            Um card vive em vários quadros sem duplicar. Setor e obra populam automaticamente;
            custom é manual.
          </p>
        </div>
        <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" /> Novo quadro
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo quadro custom</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="novo-quadro-nome">Nome</Label>
                <Input
                  id="novo-quadro-nome"
                  autoFocus
                  placeholder="Nome do quadro"
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && criarCustom()}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Template de listas</Label>
                <Select
                  value={novoTemplate}
                  onValueChange={(v) => setNovoTemplate(v as TemplateId)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATES_DISPONIVEIS.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setNovoOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={criarCustom} disabled={!novoNome.trim()}>
                Criar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Button asChild variant="outline">
          <Link to="/quadros/meus">
            <User className="h-4 w-4" /> Meus cards
          </Link>
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="todos">Todos</TabsTrigger>
          <TabsTrigger value="favoritos">Favoritos</TabsTrigger>
          <TabsTrigger value="setor">Setor</TabsTrigger>
          <TabsTrigger value="obra">Obra</TabsTrigger>
          <TabsTrigger value="custom">Custom</TabsTrigger>
          <TabsTrigger value="arquivados">Arquivados</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          <QueryState
            isLoading={q.isLoading}
            isError={q.isError}
            error={q.error}
            data={filtrado}
            onRetry={() => q.refetch()}
          >
            {(rows) =>
              rows.length === 0 ? (
                <div className="text-sm text-muted-foreground p-8 text-center border rounded-md">
                  Nenhum quadro nesta aba.
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {rows.map((b) => {
                    const Icon = TIPO_ICON[b.tipo];
                    return (
                      <Card key={b.id} className="hover:border-primary/50 transition-colors">
                        <CardContent className="p-4 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <Link
                              to={`/quadros/${b.id}`}
                              className="font-medium hover:text-primary flex items-center gap-2 min-w-0"
                            >
                              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                              <span className="truncate">{b.nome}</span>
                            </Link>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                aria-label={
                                  favoritos.has(b.id)
                                    ? "Remover dos favoritos"
                                    : "Adicionar aos favoritos"
                                }
                                title={
                                  favoritos.has(b.id)
                                    ? "Remover dos favoritos"
                                    : "Adicionar aos favoritos"
                                }
                                onClick={() => toggleFavorito(b)}
                              >
                                <Star
                                  className={
                                    favoritos.has(b.id)
                                      ? "h-4 w-4 fill-primary text-primary"
                                      : "h-4 w-4 text-muted-foreground"
                                  }
                                />
                              </Button>
                              <Badge variant="outline" className="text-[10px]">
                                {b.tipo}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center justify-end">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleArquivar(b)}
                              title={b.arquivado ? "Desarquivar" : "Arquivar"}
                            >
                              {b.arquivado ? (
                                <>
                                  <ArchiveRestore className="h-4 w-4" /> Desarquivar
                                </>
                              ) : (
                                <>
                                  <Archive className="h-4 w-4" /> Arquivar
                                </>
                              )}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )
            }
          </QueryState>
        </TabsContent>
      </Tabs>
    </div>
  );
}
