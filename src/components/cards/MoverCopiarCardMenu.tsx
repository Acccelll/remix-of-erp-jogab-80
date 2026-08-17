/**
 * MoverCopiarCardMenu — H4.2
 *
 * Botão com Popover que oferece "Mover para outro board" e
 * "Copiar para outro board" no detalhe do card.
 * - Mover: UPDATE em card_board_posicao do board ORIGEM → board DESTINO,
 *   lista = 1ª lista do destino, posição = max+1.
 * - Copiar: INSERT novo card clonando título/descrição + setores +
 *   labels + checklist + posições e atividade "copiado_de".
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  cardsQueryFns,
  useInsertCard,
  useInsertCardAtividade,
  useInsertCardBoardPosicao,
  useInsertCardLabelLinks,
  useInsertCardSetores,
  useInsertChecklistItems,
  useMoverCardBoardPosicaoParaBoard,
} from "@/hooks/quadros/useCards";
import { boardsKeys, boardsQueryFns } from "@/hooks/quadros/useBoards";
import { useAuth } from "@/contexts/auth/useAuth";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Copy, MoveRight, Loader2 } from "lucide-react";

interface BoardOpt {
  id: string;
  nome: string;
  tipo: string;
}

interface Props {
  cardId: string;
  boardAtualId?: string | null;
}

export default function MoverCopiarCardMenu({ cardId, boardAtualId }: Props) {
  const qc = useQueryClient();
  const { currentPlayer } = useAuth();
  const insertCardMut = useInsertCard();
  const insertCardSetoresMut = useInsertCardSetores();
  const insertCardLabelLinksMut = useInsertCardLabelLinks();
  const insertChecklistItemsMut = useInsertChecklistItems();
  const insertCardAtividadeMut = useInsertCardAtividade();
  const insertCardBoardPosicaoMut = useInsertCardBoardPosicao();
  const moverCardBoardPosicaoParaBoardMut = useMoverCardBoardPosicaoParaBoard();
  const [open, setOpen] = useState(false);
  const [destinoMover, setDestinoMover] = useState<string>("");
  const [destinoCopiar, setDestinoCopiar] = useState<string>("");
  const [acao, setAcao] = useState<null | "mover" | "copiar">(null);

  const { data: boards = [] } = useQuery({
    enabled: open,
    queryKey: boardsKeys.ativosMin,
    queryFn: async (): Promise<BoardOpt[]> => {
      const data = await boardsQueryFns.listAtivosMin();
      return (data ?? []).map((b: any) => ({ id: b.id, nome: b.nome, tipo: b.tipo }));
    },
  });

  const opcoes = boards.filter((b) => b.id !== boardAtualId);

  async function primeiraListaDe(boardId: string): Promise<string | null> {
    return await boardsQueryFns.primeiraListaAtiva(boardId);
  }

  async function maxPosNaLista(listaId: string): Promise<number> {
    return await cardsQueryFns.maxPosBoardPosicaoNaLista(listaId);
  }


  async function mover() {
    if (!destinoMover || !boardAtualId) return;
    setAcao("mover");
    try {
      const listaId = await primeiraListaDe(destinoMover);
      if (!listaId) {
        toast.error("Quadro destino não tem listas");
        return;
      }
      const pos = await maxPosNaLista(listaId);
      const { error } = await moverCardBoardPosicaoParaBoardMut.mutateAsync({
        cardId,
        deBoardId: boardAtualId,
        paraBoardId: destinoMover,
        listaId,
        posicao: pos,
      });
      if (error) {
        toast.error("Falha ao mover", { description: error.message });
        return;
      }
      await insertCardAtividadeMut.mutateAsync({
        cardId,
        payload: {
          card_id: cardId,
          evento: "movido_board",
          ator_id: currentPlayer?.id ?? null,
          ator_nome: currentPlayer?.login ?? "Sistema",
          detalhe: { de: boardAtualId, para: destinoMover } as never,
        },
      });
      toast.success("Card movido");
      qc.invalidateQueries({ queryKey: ["board-items", boardAtualId] });
      qc.invalidateQueries({ queryKey: ["board-items", destinoMover] });
      setOpen(false);
    } finally {
      setAcao(null);
    }
  }

  async function copiar() {
    if (!destinoCopiar) return;
    setAcao("copiar");
    try {
      // 1) Carrega card origem
      const { data: orig, error: e0 } = await cardsQueryFns.getParaClonar(cardId);
      if (e0 || !orig) {
        toast.error("Card de origem não encontrado");
        return;
      }
      // 2) Cria clone
      const { data: novo, error: e1 } = await insertCardMut.mutateAsync({
        tipo: (orig as any).tipo ?? "generico",
        status: (orig as any).status ?? "aberto",
        titulo: `${orig.titulo} (cópia)`,
        descricao: (orig as any).descricao ?? null,
        obra_id: orig.obra_id ?? null,
        prazo: orig.prazo ?? null,
        data_inicio: (orig as any).data_inicio ?? null,
        capa_cor: orig.capa_cor ?? null,
        capa_url: orig.capa_url ?? null,
        responsavel_id: orig.responsavel_id ?? null,
        criado_por: currentPlayer?.login ?? "sistema",
      });
      if (e1 || !novo) {
        toast.error("Falha ao copiar", { description: e1?.message });
        return;
      }

      // 3) Clona setores
      const sets = await cardsQueryFns.listSetoresByCard(cardId).catch(() => [] as any[]);
      if (sets?.length) {
        await insertCardSetoresMut.mutateAsync(
          sets.map((s: any) => ({ card_id: novo.id, setor: s.setor })),
        );
      }
      // 4) Clona labels
      const { data: lbs } = await cardsQueryFns.listCardLabelLinksByCard(cardId);
      if (lbs?.length) {
        await insertCardLabelLinksMut.mutateAsync(
          lbs.map((l: any) => ({ card_id: novo.id, label_id: l.label_id })),
        );
      }
      // 5) Clona checklist
      let chk: any[] = [];
      try {
        chk = await cardsQueryFns.listChecklistByCard(cardId);
      } catch {
        chk = [];
      }
      if (chk?.length) {

        await insertChecklistItemsMut.mutateAsync({
          cardId: novo.id,
          rows: chk.map((c: any) => ({
            card_id: novo.id,
            grupo: c.grupo,
            texto: c.texto,
            ordem: c.ordem,
            prazo: c.prazo,
            responsavel_id: c.responsavel_id,
            concluido: false,
          })),
        });
      }
      // 6) Posiciona no board destino (1ª lista)
      const listaId = await primeiraListaDe(destinoCopiar);
      if (listaId) {
        const pos = await maxPosNaLista(listaId);
        await insertCardBoardPosicaoMut.mutateAsync({
          card_id: novo.id,
          board_id: destinoCopiar,
          lista_id: listaId,
          posicao: pos,
        });
      }
      // 7) Atividade
      await insertCardAtividadeMut.mutateAsync({
        cardId: novo.id,
        payload: {
          card_id: novo.id,
          evento: "copiado_de",
          ator_id: currentPlayer?.id ?? null,
          ator_nome: currentPlayer?.login ?? "Sistema",
          detalhe: { origem_card_id: cardId, destino_board_id: destinoCopiar } as never,
        },
      });
      toast.success("Card copiado");
      qc.invalidateQueries({ queryKey: ["board-items", destinoCopiar] });
      setOpen(false);
    } finally {
      setAcao(null);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" title="Mover ou copiar card">
          <MoveRight className="h-4 w-4 mr-1" /> Mover / Copiar
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3 space-y-3">
        {boardAtualId && (
          <div className="space-y-1.5">
            <Label className="text-xs">Mover para</Label>
            <div className="flex gap-1.5">
              <Select value={destinoMover} onValueChange={setDestinoMover}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Outro quadro…" />
                </SelectTrigger>
                <SelectContent>
                  {opcoes.length === 0 && (
                    <SelectItem value="__none" disabled>
                      Sem destinos disponíveis
                    </SelectItem>
                  )}
                  {opcoes.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={mover} disabled={!destinoMover || acao === "mover"}>
                {acao === "mover" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Mover"}
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-1.5 border-t pt-2">
          <Label className="text-xs flex items-center gap-1.5">
            <Copy className="h-3.5 w-3.5" /> Copiar para
          </Label>
          <div className="flex gap-1.5">
            <Select value={destinoCopiar} onValueChange={setDestinoCopiar}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Outro quadro…" />
              </SelectTrigger>
              <SelectContent>
                {boards.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={copiar} disabled={!destinoCopiar || acao === "copiar"}>
              {acao === "copiar" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Copiar"}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Clona título, descrição, setores, etiquetas e checklist. Comentários e anexos não são
            copiados.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
