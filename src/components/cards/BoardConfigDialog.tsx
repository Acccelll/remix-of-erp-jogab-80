/**
 * BoardConfigDialog — configura Campos personalizados e Membros do board.
 * Acessado pelo botão de engrenagem no header do QuadroBoard.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  boardsKeys,
  boardsQueryFns,
  useInsertBoardCampo,
  useInsertBoardMembro,
  useRemoveBoardCampo,
  useRemoveBoardMembro,
  useUpdateBoardMembroPapel,
} from "@/hooks/quadros/useBoards";
import { cardsQueryFns } from "@/hooks/quadros/useCards";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import BoardExtensoesTab from "@/components/cards/BoardExtensoesTab";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, GripVertical, Settings, UserPlus } from "lucide-react";
import { FileJson } from "lucide-react";
import ImportarTrelloDialog from "@/components/cards/ImportarTrelloDialog";
import BoardIdentidadeTab from "@/components/cards/BoardIdentidadeTab";

type Tipo = "texto" | "numero" | "data" | "dropdown" | "checkbox";
interface CampoRow {
  id: string;
  nome: string;
  tipo: Tipo;
  opcoes: string[];
  ordem: number;
}
interface MembroRow {
  user_id: string;
  papel: "admin" | "membro" | "observador";
  profile?: { login: string | null; email: string | null };
}

interface Props {
  boardId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export default function BoardConfigDialog({ boardId, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [trelloOpen, setTrelloOpen] = useState(false);
  const [confirmacao, setConfirmacao] = useState<
    | { tipo: "campo"; id: string; label: string }
    | { tipo: "membro"; id: string; label: string }
    | null
  >(null);

  // ---- Campos
  const insertCampoMut = useInsertBoardCampo();
  const removeCampoMut = useRemoveBoardCampo();
  const insertMembroMut = useInsertBoardMembro();
  const updateMembroPapelMut = useUpdateBoardMembroPapel();
  const removeMembroMut = useRemoveBoardMembro();

  const campos = useQuery({
    enabled: open,
    queryKey: boardsKeys.campos(boardId),
    queryFn: async (): Promise<CampoRow[]> => {
      const data = await boardsQueryFns.listCamposByBoard(boardId);
      return (data ?? []).map((r: any) => ({
        ...r,
        opcoes: Array.isArray(r.opcoes) ? r.opcoes : [],
      })) as CampoRow[];
    },
  });
  const [novoNome, setNovoNome] = useState("");
  const [novoTipo, setNovoTipo] = useState<Tipo>("texto");
  const [novoOpcoes, setNovoOpcoes] = useState("");

  async function addCampo() {
    const nome = novoNome.trim();
    if (!nome) return;
    const opcoes =
      novoTipo === "dropdown"
        ? novoOpcoes
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
    const ordem = campos.data?.length ?? 0;
    const { error } = await insertCampoMut.mutateAsync({
      board_id: boardId,
      nome,
      tipo: novoTipo,
      opcoes,
      ordem,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setNovoNome("");
    setNovoOpcoes("");
    setNovoTipo("texto");
  }
  async function delCampo(id: string) {
    const { error } = await removeCampoMut.mutateAsync({ id, boardId });
    if (error) return toast.error(error.message);
  }

  // ---- Membros
  const membros = useQuery({
    enabled: open,
    queryKey: boardsKeys.membros(boardId),
    queryFn: async (): Promise<MembroRow[]> => {
      const { data, error } = await boardsQueryFns.listMembrosByBoard(boardId);
      if (error) throw error;
      return (data ?? []) as any;
    },
  });
  const [buscaUser, setBuscaUser] = useState("");
  const buscaProfiles = useQuery({
    enabled: open && buscaUser.length >= 2,
    queryKey: ["profiles-busca", buscaUser],
    queryFn: async () => await cardsQueryFns.searchProfiles(buscaUser),
  });

  async function addMembro(userId: string) {
    const { error } = await insertMembroMut.mutateAsync({
      board_id: boardId,
      user_id: userId,
      papel: "membro",
    });
    if (error) return toast.error(error.message);
    setBuscaUser("");
  }
  async function setPapel(userId: string, papel: MembroRow["papel"]) {
    const { error } = await updateMembroPapelMut.mutateAsync({ boardId, userId, papel });
    if (error) return toast.error(error.message);
  }
  async function delMembro(userId: string) {
    const { error } = await removeMembroMut.mutateAsync({ boardId, userId });
    if (error) return toast.error(error.message);
  }

  async function confirmar() {
    if (!confirmacao) return;
    const c = confirmacao;
    setConfirmacao(null);
    if (c.tipo === "campo") await delCampo(c.id);
    else await delMembro(c.id);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-4 w-4" /> Configurar quadro
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="quadro">
          <TabsList>
            <TabsTrigger value="quadro">Quadro</TabsTrigger>
            <TabsTrigger value="campos">Campos personalizados</TabsTrigger>
            <TabsTrigger value="extensoes">Extensões</TabsTrigger>
            <TabsTrigger value="membros">Membros</TabsTrigger>
            <TabsTrigger value="importar">Importar Trello</TabsTrigger>
          </TabsList>

          <TabsContent value="quadro" className="space-y-3 mt-3">
            <BoardIdentidadeTab boardId={boardId} enabled={open} />
          </TabsContent>

          <TabsContent value="extensoes" className="space-y-3 mt-3">
            <BoardExtensoesTab boardId={boardId} />
          </TabsContent>

          <TabsContent value="campos" className="space-y-3 mt-3">
            <div className="space-y-1.5 border rounded-md p-3">
              <Label className="text-xs">Novo campo</Label>
              <div className="grid grid-cols-[1fr_140px_auto] gap-2 items-end">
                <Input
                  placeholder="Nome (ex.: prioridade)"
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  className="h-8"
                />
                <Select value={novoTipo} onValueChange={(v) => setNovoTipo(v as Tipo)}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="texto">Texto</SelectItem>
                    <SelectItem value="numero">Número</SelectItem>
                    <SelectItem value="data">Data</SelectItem>
                    <SelectItem value="dropdown">Dropdown</SelectItem>
                    <SelectItem value="checkbox">Checkbox</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={addCampo} disabled={!novoNome.trim()}>
                  <Plus className="h-3.5 w-3.5" /> Adicionar
                </Button>
              </div>
              {novoTipo === "dropdown" && (
                <Input
                  placeholder="Opções separadas por vírgula"
                  value={novoOpcoes}
                  onChange={(e) => setNovoOpcoes(e.target.value)}
                  className="h-8 mt-1.5"
                />
              )}
            </div>

            <div className="space-y-1">
              {campos.isLoading ? (
                <p className="text-xs text-muted-foreground">Carregando…</p>
              ) : (campos.data ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Nenhum campo definido.</p>
              ) : (
                (campos.data ?? []).map((c) => (
                  <div key={c.id} className="flex items-center gap-2 p-2 border rounded-md">
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm flex-1 truncate">{c.nome}</span>
                    <span className="text-[10px] text-muted-foreground uppercase">{c.tipo}</span>
                    {c.tipo === "dropdown" && c.opcoes.length > 0 && (
                      <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                        {c.opcoes.join(", ")}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remover coluna"
                      className="h-6 w-6"
                      onClick={() => setConfirmacao({ tipo: "campo", id: c.id, label: c.nome })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="membros" className="space-y-3 mt-3">
            <div className="space-y-1.5 border rounded-md p-3">
              <Label className="text-xs">Adicionar membro (busca por login/email)</Label>
              <Input
                className="h-8"
                placeholder="Digite ao menos 2 caracteres…"
                value={buscaUser}
                onChange={(e) => setBuscaUser(e.target.value)}
              />
              {buscaUser.length >= 2 && (
                <div className="space-y-1 max-h-40 overflow-auto">
                  {(buscaProfiles.data ?? []).length === 0 ? (
                    <p className="text-[11px] text-muted-foreground italic">Sem resultados.</p>
                  ) : (
                    (buscaProfiles.data ?? []).map((p: any) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between gap-2 px-2 py-1 rounded hover:bg-accent"
                      >
                        <div className="min-w-0">
                          <p className="text-xs truncate">{p.login ?? p.email ?? p.id}</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => addMembro(p.id)}>
                          <UserPlus className="h-3 w-3" /> Adicionar
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="space-y-1">
              {membros.isLoading ? (
                <p className="text-xs text-muted-foreground">Carregando…</p>
              ) : (membros.data ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Nenhum membro além do dono.</p>
              ) : (
                (membros.data ?? []).map((m) => (
                  <div key={m.user_id} className="flex items-center gap-2 p-2 border rounded-md">
                    <span className="text-sm flex-1 truncate">
                      {m.profile?.login ?? m.profile?.email ?? m.user_id}
                    </span>
                    <Select
                      value={m.papel}
                      onValueChange={(v) => setPapel(m.user_id, v as MembroRow["papel"])}
                    >
                      <SelectTrigger className="h-7 w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">admin</SelectItem>
                        <SelectItem value="membro">membro</SelectItem>
                        <SelectItem value="observador">observador</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remover papel"
                      className="h-6 w-6"
                      onClick={() =>
                        setConfirmacao({
                          tipo: "membro",
                          id: m.user_id,
                          label: m.profile?.login ?? m.profile?.email ?? m.user_id,
                        })
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="importar" className="space-y-3 mt-3">
            <div className="border rounded-md p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FileJson className="h-4 w-4" /> Importar board do Trello
              </div>
              <p className="text-xs text-muted-foreground">
                Cole o JSON exportado do Trello ou envie o arquivo. Você poderá mapear listas para
                status, escolher setor/obra e revisar antes de gravar.
              </p>
              <Button size="sm" onClick={() => setTrelloOpen(true)}>
                <FileJson className="h-3.5 w-3.5" /> Abrir importador
              </Button>
            </div>
          </TabsContent>
        </Tabs>
        <AlertDialog open={!!confirmacao} onOpenChange={(o) => !o && setConfirmacao(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirmacao?.tipo === "campo" ? "Excluir campo" : "Remover membro"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmacao?.tipo === "campo" ? (
                  <>
                    O campo <strong>{confirmacao?.label}</strong> e todos os valores associados
                    serão removidos.
                  </>
                ) : (
                  <>
                    Remover <strong>{confirmacao?.label}</strong> do quadro?
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmar}>
                {confirmacao?.tipo === "campo" ? "Excluir" : "Remover"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
      <ImportarTrelloDialog boardId={boardId} open={trelloOpen} onOpenChange={setTrelloOpen} />
    </Dialog>
  );
}
