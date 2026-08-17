// @ts-nocheck
/**
 * CardGenericoDialog — Detalhe estilo Trello para cards genéricos.
 *
 * Layout: corpo principal (título, descrição, checklist, comentários, atividade)
 * + rail lateral (status, prazo, responsável, setores, etiquetas).
 *
 * Cobre Passo 1.3 (detalhe), 1.4 parcial (checklist/coments/atividade) e
 * 1.5 (log de atividade em toda mudança).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cardAnexosStorage } from "@/lib/repositories/storage";
import { cardsKeys, cardsQueryFns, useInsertCardAnexo, useInsertCardAtividade, useInsertCardComentario, useInsertCardLabelLink, useInsertCardMembro, useInsertCardSetor, useInsertChecklistItem, useInsertNotificacao, useInsertNotificacoes, useRemoveCardAnexo, useRemoveCardAnexosByCard, useRemoveCardCustomFieldValoresByCard, useRemoveCardLabelLink, useRemoveCardLabelsByCard, useRemoveCardLocalByCard, useRemoveCardMembro, useRemoveCardMembrosByCard, useRemoveCardSecaoVisivel, useRemoveCardSetor, useRemoveChecklistByCard, useRemoveChecklistGrupo, useRemoveChecklistItem, useSetChecklistItemConcluido, useUpdateCard, useUpdateCardReturningId, useUpdateChecklistGrupo, useUpdateChecklistItem, useUpsertCardSecaoVisivel } from "@/hooks/quadros/useCards";
import { cronogramaKeys, cronogramaQueryFns } from "@/hooks/obras/useCronograma";
import { useAuth } from "@/contexts/auth/useAuth";
import { usePlayers } from "@/hooks/usePlayers";
import { getMeusUserIds, normalizarLogin } from "@/lib/auth/identidade";
import { queryKey } from "@/lib/query-keys";
import { STATUS_GENERICO, type StatusGenerico } from "@/lib/cards/generico";
import { aplicarMencao, extrairMencoes, mencaoEmCurso } from "@/lib/cards/mencoes";
import { montarTimeline, resolverPai, resumoCitacao } from "@/lib/cards/timeline";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import MoverCopiarCardMenu from "@/components/cards/MoverCopiarCardMenu";
import CardCamposCustom from "@/components/cards/CardCamposCustom";
import CardVinculosSection from "@/components/cards/CardVinculosSection";
import RestricoesDoCardBadge from "@/components/cards/RestricoesDoCardBadge";
import RiscosDoCardBadge from "@/components/cards/RiscosDoCardBadge";
import UltimoRdoBadge from "@/components/cards/UltimoRdoBadge";
import MarkdownView from "@/components/cards/MarkdownView";
import RichTextEditor from "@/components/cards/RichTextEditor";
import CommentEditor from "@/components/cards/CommentEditor";
import CardLocalSection from "@/components/cards/CardLocalSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  CalendarDays,
  CheckSquare,
  MessageSquare,
  Tag,
  Users,
  UserCircle2,
  Plus,
  Trash2,
  History,
  Paperclip,
  Download,
  Upload,
  Archive,
  ArchiveRestore,
  Pencil,
  AlignLeft,
  ArrowRight,
  Check,
  X,
} from "lucide-react";
import { CornerUpLeft, Eye, EyeOff } from "lucide-react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCardPermissions } from "@/hooks/quadros/useCardPermissions";
import { CORES_PALETA, isHexCor } from "@/lib/cards/cores";
import {
  SECOES_OPCIONAIS,
  SECAO_LABEL,
  isSecaoVisivel,
  secoesAdicionaveis,
  type SecaoOpcional,
} from "@/lib/cards/secoesVisiveis";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
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
import { fmtDiaExtenso } from "@/lib/core/date";
import { getDocumentoNumeroLocal } from "@/lib/empresa/documento-numeracao-local";

type LabelRow = { id: string; nome: string; cor: string };
type ProfileRow = { id: string; login: string | null; email: string | null };

interface Props {
  cardId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Board atual de onde o card foi aberto — habilita "Mover" para outro quadro. */
  boardAtualId?: string | null;
}

function iniciais(nome: string): string {
  return nome
    .split(/[.\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

function formatDataHora(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

type EventoCategoria =
  | "status"
  | "prazo"
  | "responsavel"
  | "etiquetas"
  | "checklist"
  | "comentarios"
  | "anexos"
  | "outros";

function categoriaEvento(evento: string): EventoCategoria {
  if (evento === "status" || evento === "status_alterado") return "status";
  if (evento === "prazo" || evento === "prazo_alterado") return "prazo";
  if (evento === "responsavel" || evento === "responsavel_alterado" || evento === "card_atribuido")
    return "responsavel";
  if (evento.startsWith("label_") || evento.startsWith("setor_")) return "etiquetas";
  if (evento.startsWith("checklist")) return "checklist";
  if (evento === "comentario") return "comentarios";
  if (evento.startsWith("anexo")) return "anexos";
  return "outros";
}

function iconeEvento(evento: string) {
  const cat = categoriaEvento(evento);
  switch (cat) {
    case "status":
      return ArrowRight;
    case "prazo":
      return CalendarDays;
    case "responsavel":
      return UserCircle2;
    case "etiquetas":
      return Tag;
    case "checklist":
      return CheckSquare;
    case "comentarios":
      return MessageSquare;
    case "anexos":
      return Paperclip;
    default:
      if (evento === "arquivado") return Archive;
      if (evento === "restaurado") return ArchiveRestore;
      if (evento === "titulo") return Pencil;
      if (evento === "descricao") return AlignLeft;
      return History;
  }
}

function descreverAtividade(evento: string, detalhe: any): string {
  switch (evento) {
    case "criado":
      return `criou o card`;
    case "status":
    case "status_alterado":
      return `mudou status: ${detalhe?.de ?? "?"} → ${detalhe?.para ?? "?"}`;
    case "titulo":
      return `renomeou para "${detalhe?.para ?? ""}"`;
    case "descricao":
      return `editou a descrição`;
    case "prazo":
    case "prazo_alterado":
      return detalhe?.para ? `definiu prazo ${detalhe.para}` : `removeu prazo`;
    case "responsavel":
    case "responsavel_alterado":
      return detalhe?.para_nome || detalhe?.para
        ? `atribuiu a ${detalhe.para_nome ?? detalhe.para}`
        : `removeu responsável`;
    case "card_atribuido":
      return `foi atribuído como responsável`;
    case "setor_add":
      return `adicionou setor ${detalhe?.setor ?? ""}`;
    case "setor_remove":
      return `removeu setor ${detalhe?.setor ?? ""}`;
    case "label_add":
      return `adicionou etiqueta ${detalhe?.nome ?? ""}`;
    case "label_remove":
      return `removeu etiqueta ${detalhe?.nome ?? ""}`;
    case "checklist_add":
      return `+ checklist: ${detalhe?.texto ?? ""}`;
    case "checklist_done":
      return `concluiu: ${detalhe?.texto ?? ""}`;
    case "checklist_undone":
      return `reabriu: ${detalhe?.texto ?? ""}`;
    case "comentario":
      return `comentou`;
    case "anexo_add":
      return `anexou ${detalhe?.nome ?? "arquivo"}`;
    case "anexo_remove":
      return `removeu anexo ${detalhe?.nome ?? ""}`;
    case "arquivado":
      return `arquivou o card`;
    case "restaurado":
      return `restaurou o card`;
    case "capa":
      if (detalhe?.capa_url) return `alterou a capa (imagem)`;
      if (detalhe?.capa_cor) return `alterou a cor da capa`;
      return `removeu a capa`;
    default:
      return evento;
  }
}

const SETORES_PADRAO = [
  "engenharia",
  "suprimentos",
  "financeiro",
  "obra",
  "rh",
  "dp",
  "qualidade",
  "segurança",
];

function numeroContratoVinculado(card: any): string | null {
  const origem = String(card?.origem_externa ?? "").toLowerCase();
  const contratoId = origem === "contrato" || origem === "contratos" ? card?.origem_id : null;
  if (!contratoId) return null;
  return (
    getDocumentoNumeroLocal(contratoId, "contrato")?.numero ??
    `CTR-${String(contratoId).slice(-6).toUpperCase()}`
  );
}

export default function CardGenericoDialog({
  cardId,
  open,
  onOpenChange,
  boardAtualId = null,
}: Props) {
  const { currentPlayer } = useAuth();
  const qc = useQueryClient();
  const updateCardMut = useUpdateCard();
  const updateCardReturningIdMut = useUpdateCardReturningId();
  const insertCardSetorMut = useInsertCardSetor();
  const removeCardSetorMut = useRemoveCardSetor();
  const insertCardLabelLinkMut = useInsertCardLabelLink();
  const removeCardLabelLinkMut = useRemoveCardLabelLink();
  const removeCardLabelsByCardMut = useRemoveCardLabelsByCard();
  const insertCardMembroMut = useInsertCardMembro();
  const removeCardMembroMut = useRemoveCardMembro();
  const removeCardMembrosByCardMut = useRemoveCardMembrosByCard();
  const insertChecklistItemMut = useInsertChecklistItem();
  const updateChecklistItemMut = useUpdateChecklistItem();
  const updateChecklistGrupoMut = useUpdateChecklistGrupo();
  const setChecklistConcluidoMut = useSetChecklistItemConcluido();
  const removeChecklistItemMut = useRemoveChecklistItem();
  const removeChecklistGrupoMut = useRemoveChecklistGrupo();
  const removeChecklistByCardMut = useRemoveChecklistByCard();
  const insertCardAnexoMut = useInsertCardAnexo();
  const removeCardAnexoMut = useRemoveCardAnexo();
  const removeCardAnexosByCardMut = useRemoveCardAnexosByCard();
  const insertCardComentarioMut = useInsertCardComentario();
  const insertCardAtividadeMut = useInsertCardAtividade();
  const removeCardCustomFieldValoresByCardMut = useRemoveCardCustomFieldValoresByCard();
  const upsertCardSecaoVisivelMut = useUpsertCardSecaoVisivel();
  const removeCardSecaoVisivelMut = useRemoveCardSecaoVisivel();
  const removeCardLocalByCardMut = useRemoveCardLocalByCard();
  const insertNotificacaoMut = useInsertNotificacao();
  const insertNotificacoesMut = useInsertNotificacoes();
  const ator = currentPlayer?.login ?? "sistema";

  // Carrega card completo
  const {
    data: card,
    isLoading,
    isError,
    error,
  } = useQuery({
    enabled: !!cardId && open,
    queryKey: ["card-generico", cardId],
    queryFn: async () => cardsQueryFns.getCardGenericoDialog(cardId!),
  });

  const cardSetores = useMemo(
    () => (card ? (card.card_setores ?? []).map((s: any) => s.setor as string) : undefined),
    [card],
  );
  const perms = useCardPermissions(cardSetores);
  const canEdit = perms.canEdit;

  const { data: labels = [] } = useQuery({
    queryKey: cardsKeys.labels,
    queryFn: async (): Promise<LabelRow[]> => cardsQueryFns.listCardLabels(),
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-min"],
    queryFn: () => cardsQueryFns.listProfilesMin() as Promise<ProfileRow[]>,
  });

  // A tabela `profiles` acumulou contas antigas/duplicadas (ex.: "Copato" e
  // "copatto"). Para seleção, só mostramos perfis que correspondem a um
  // usuário ativo cadastrado no GM, deduplicados por login normalizado.
  const { data: usuariosGM = [] } = usePlayers();
  const profilesSelecionaveis = useMemo(() => {
    const ativos = new Set(usuariosGM.map((u) => normalizarLogin(u.login)));
    const porLogin = new Map<string, ProfileRow>();
    for (const p of profiles) {
      const chave = normalizarLogin((p as any).login);
      if (!chave || (ativos.size > 0 && !ativos.has(chave))) continue;
      if (!porLogin.has(chave)) porLogin.set(chave, p);
    }
    return Array.from(porLogin.values()).sort((a, b) =>
      String((a as any).login ?? "").localeCompare(String((b as any).login ?? "")),
    );
  }, [profiles, usuariosGM]);



  const { data: checklist = [], refetch: refetchChecklist } = useQuery({
    enabled: !!cardId && open,
    queryKey: cardsKeys.checklist(cardId ?? ""),
    queryFn: () => cardsQueryFns.listChecklistByCard(cardId!),
  });

  const { data: membros = [], refetch: refetchMembros } = useQuery({
    enabled: !!cardId && open,
    queryKey: cardsKeys.membros(cardId ?? ""),
    queryFn: () => cardsQueryFns.listCardMembroUserIds(cardId!),
  });

  // Ids de autenticação do usuário atual (pode ter contas irmãs por login).
  // Servem para liberar o "X" de sair do card mesmo sem permissão de edição.
  const { data: meusUserIds = [] } = useQuery({
    enabled: open,
    queryKey: queryKey("meus-user-ids", currentPlayer?.login ?? ""),
    queryFn: () => getMeusUserIds(currentPlayer?.login ?? null),
    staleTime: 5 * 60_000,
  });
  const souEuMembro = (uid: string) => meusUserIds.includes(uid);


  const { data: comentarios = [], refetch: refetchComents } = useQuery({
    enabled: !!cardId && open,
    queryKey: cardsKeys.comentarios(cardId ?? ""),
    queryFn: () => cardsQueryFns.listComentariosByCard(cardId!),
  });

  const { data: atividades = [], refetch: refetchAtividades } = useQuery({
    enabled: !!cardId && open,
    queryKey: cardsKeys.atividades(cardId ?? ""),
    queryFn: () => cardsQueryFns.listAtividadesByCard(cardId!),
  });

  const { data: anexos = [], refetch: refetchAnexos } = useQuery({
    enabled: !!cardId && open,
    queryKey: cardsKeys.anexos(cardId ?? ""),
    queryFn: () => cardsQueryFns.listAnexosByCard(cardId!),
  });

  // H1 — visibilidade de seções e dados auxiliares
  const { data: secoesRegistradas = [], refetch: refetchSecoes } = useQuery({
    enabled: !!cardId && open,
    queryKey: cardsKeys.secoesVisiveis(cardId ?? ""),
    queryFn: async () => (await cardsQueryFns.listSecoesVisiveisByCard(cardId!)) as SecaoOpcional[],
  });

  const { data: temLocal = false, refetch: refetchTemLocal } = useQuery({
    enabled: !!cardId && open,
    queryKey: cardsKeys.temLocal(cardId ?? ""),
    queryFn: async () => cardsQueryFns.existsLocalByCard(cardId!),
  });

  // H3 — etapas do cronograma disponíveis para vínculo (filtradas pela obra do card)
  const { data: cronogramaItens = [] } = useQuery({
    enabled: !!card?.obra_id && open,
    queryKey: cronogramaKeys.itensParaVinculoByObra(card?.obra_id ?? ""),
    queryFn: async () =>
      cronogramaQueryFns.listAtivosParaVinculoByObra(card!.obra_id as string),
  });

  // Estado local editável de título/descrição (commit on blur)
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [novoComent, setNovoComent] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [mostrarDetalhes, setMostrarDetalhes] = useState<boolean>(false);
  const [cursorPos, setCursorPos] = useState(0);
  const [mencaoIdx, setMencaoIdx] = useState(0);
  const comentRef = useRef<HTMLTextAreaElement | null>(null);
  const [novoChecklist, setNovoChecklist] = useState("");
  const [novosPorGrupo, setNovosPorGrupo] = useState<Record<string, string>>({});
  const [renomeandoGrupo, setRenomeandoGrupo] = useState<string | null>(null);
  const [novoNomeGrupo, setNovoNomeGrupo] = useState("");
  const [uploading, setUploading] = useState(false);
  const [filtroAtividade, setFiltroAtividade] = useState<string>("__all");
  const [editarDescricao, setEditarDescricao] = useState(false);
  const [secaoParaRemover, setSecaoParaRemover] = useState<SecaoOpcional | null>(null);
  const [grupoChecklistParaRemover, setGrupoChecklistParaRemover] = useState<{
    grupo: string;
    total: number;
  } | null>(null);
  const [anexoParaRemover, setAnexoParaRemover] = useState<any | null>(null);

  useEffect(() => {
    if (card) {
      setTitulo(card.titulo);
      setDescricao(card.descricao ?? "");
    }
  }, [card?.id]);

  const logAtividade = useCallback(
    async (evento: string, detalhe: Record<string, unknown>) => {
      if (!cardId) return;
      await insertCardAtividadeMut.mutateAsync({
        cardId,
        payload: {
          card_id: cardId,
          ator_id: currentPlayer?.id ?? null,
          ator_nome: ator,
          evento,
          detalhe: detalhe as never,
        },
      });
      refetchAtividades();
    },
    [cardId, ator, currentPlayer?.id, refetchAtividades],
  );

  const invalidateBoard = () => {
    qc.invalidateQueries({ queryKey: ["quadro-geral-cards"] });
    qc.invalidateQueries({ queryKey: ["board-items"] });
    qc.invalidateQueries({ queryKey: ["board"] });
    qc.invalidateQueries({ queryKey: ["boards-index"] });
    qc.invalidateQueries({ queryKey: ["kanban-cards"] });
    qc.invalidateQueries({ queryKey: ["card-covers"] });
  };
  const refetchCard = () => qc.invalidateQueries({ queryKey: ["card-generico", cardId] });

  /** Atualização otimista do cache do card aberto (resposta imediata na UI). */
  const patchCardCache = (patch: Record<string, any>) => {
    if (!cardId) return;
    qc.setQueryData(["card-generico", cardId], (old: any) => (old ? { ...old, ...patch } : old));
  };

  // H1 — visibilidade sob demanda. Memo combina "tem dado" + "registrada" + regra do cronograma.
  const vis = useMemo(() => {
    const reg = new Set<SecaoOpcional>(secoesRegistradas);
    const cronogramaItemId = (card as any)?.cronograma_item_id ?? null;
    const map = {} as Record<
      SecaoOpcional,
      { temDado: boolean; registrada: boolean; cronogramaItemId?: string | null }
    >;
    const temDadoPor: Record<SecaoOpcional, boolean> = {
      datas: !!card?.prazo,
      etiquetas: (card?.card_label_links ?? []).length > 0,
      checklist: (checklist ?? []).length > 0,
      membros: (membros ?? []).length > 0,
      anexos: (anexos ?? []).length > 0,
      local: !!temLocal,
      lembrete: !!card?.lembrete,
      campos_custom: false, // ainda sem UI (H5)
      cronograma: !!cronogramaItemId,
    };
    for (const s of SECOES_OPCIONAIS) {
      map[s] = { temDado: temDadoPor[s], registrada: reg.has(s), cronogramaItemId };
    }
    return {
      visivel: (s: SecaoOpcional) => isSecaoVisivel(s, map[s]),
      adicionaveis: () => secoesAdicionaveis(map),
      temDado: (s: SecaoOpcional) => map[s].temDado,
    };
  }, [secoesRegistradas, card, checklist, membros, anexos, temLocal]);

  const adicionarSecao = async (secao: SecaoOpcional) => {
    if (!cardId) return;
    // Só `card_id`/`secao` são graváveis aqui: a autoria (`criado_por`) é
    // preenchida pelo banco via `default auth.uid()`. Mandar a coluna daqui
    // quebrava com PGRST204 nos ambientes cujo schema ainda não a tem.
    const { error } = await upsertCardSecaoVisivelMut.mutateAsync({ cardId, secao });
    if (error) return toast.error("Falha ao adicionar seção", { description: error.message });
    await refetchSecoes();
  };

  const removerSecao = async (secao: SecaoOpcional) => {
    if (!cardId) return;
    const { error } = await removeCardSecaoVisivelMut.mutateAsync({ cardId, secao });
    if (error) return toast.error("Falha ao remover seção", { description: error.message });
    await refetchSecoes();
  };

  /**
   * Limpa todos os dados de uma seção opcional do card.
   * Usado quando o usuário confirma a remoção de uma seção que tem conteúdo.
   */
  const limparDadosSecao = async (secao: SecaoOpcional): Promise<void> => {
    if (!cardId || !card) return;
    switch (secao) {
      case "checklist":
        await removeChecklistByCardMut.mutateAsync(cardId);
        await refetchChecklist();
        break;
      case "membros":
        await removeCardMembrosByCardMut.mutateAsync(cardId);
        await refetchMembros();
        break;
      case "anexos":
        await removeCardAnexosByCardMut.mutateAsync(cardId);
        await refetchAnexos();
        break;
      case "etiquetas":
        await removeCardLabelsByCardMut.mutateAsync(cardId);
        patchCardCache({ card_label_links: [] });
        break;
      case "datas":
        await updateCardMut.mutateAsync({ id: cardId, patch: { prazo: null } });
        patchCardCache({ prazo: null });
        break;
      case "lembrete":
        await updateCardMut.mutateAsync({ id: cardId, patch: { lembrete: null } });
        patchCardCache({ lembrete: null });
        break;
      case "cronograma":
        await updateCardMut.mutateAsync({ id: cardId, patch: { cronograma_item_id: null } as any });
        patchCardCache({ cronograma_item_id: null });
        break;
      case "local":
        await removeCardLocalByCardMut.mutateAsync(cardId);
        await refetchTemLocal();
        break;
      case "campos_custom":
        await removeCardCustomFieldValoresByCardMut.mutateAsync(cardId);
        break;
    }
    refetchCard();
    invalidateBoard();
  };

  /**
   * Pede remoção de uma seção. Se houver dados, confirma e limpa o conteúdo;
   * em seguida remove o registro de visibilidade.
   */
  const pedirRemocaoSecao = async (secao: SecaoOpcional) => {
    if (vis.temDado(secao)) {
      setSecaoParaRemover(secao);
      return;
    }
    await removerSecao(secao);
  };

  const confirmarRemocaoSecao = async () => {
    const secao = secaoParaRemover;
    if (!secao) return;
    await limparDadosSecao(secao);
    await removerSecao(secao);
    setSecaoParaRemover(null);
  };

  // REF.A — Capa do card (cor token ou imagem). Paleta compartilhada com listas.
  const CAPA_CORES = CORES_PALETA;
  const mudarCapa = async (patch: { capa_cor?: string | null; capa_url?: string | null }) => {
    if (!card) return;
    const snapshot = { capa_cor: card.capa_cor, capa_url: card.capa_url };
    // Otimista: aplica imediatamente no cache para não exigir refresh.
    patchCardCache(patch);
    let atualizado = false;
    try {
      atualizado = await updateCardReturningIdMut.mutateAsync({ id: card.id, patch: patch as any });
    } catch (e: any) {
      patchCardCache(snapshot);
      return toast.error("Falha ao salvar capa", { description: e?.message });
    }
    if (!atualizado) {
      patchCardCache(snapshot);
      return toast.error("Sem permissão para alterar a capa deste card.");
    }
    await logAtividade("capa", { ...patch });
    invalidateBoard();
  };
  const usarAnexoComoCapa = async (anexo: any) => {
    const { data } = await cardAnexosStorage.createSignedUrl(
      anexo.storage_path,
      60 * 60 * 24 * 365,
    );
    if (!data?.signedUrl) return toast.error("Falha ao gerar URL da capa");
    await mudarCapa({ capa_url: data.signedUrl, capa_cor: null });
  };
  const anexosImagem = (anexos ?? []).filter((a: any) => (a.mime ?? "").startsWith("image/"));

  // ===== Mutações =====
  const salvarTitulo = async () => {
    if (!card || titulo.trim() === card.titulo) return;
    const novo = titulo.trim();
    if (!novo) {
      setTitulo(card.titulo);
      return;
    }
    try {
      await updateCardMut.mutateAsync({ id: card.id, patch: { titulo: novo } });
    } catch (e: any) {
      return toast.error("Falha ao salvar título", { description: e?.message });
    }
    await logAtividade("titulo", { de: card.titulo, para: novo });
    refetchCard();
    invalidateBoard();
  };

  const salvarDescricao = async () => {
    if (!card || (descricao ?? "") === (card.descricao ?? "")) return;
    try {
      await updateCardMut.mutateAsync({ id: card.id, patch: { descricao } });
    } catch (e: any) {
      return toast.error("Falha ao salvar descrição", { description: e?.message });
    }
    await logAtividade("descricao", {});
    refetchCard();
  };

  const mudarStatus = async (s: StatusGenerico) => {
    if (!card || card.status === s) return;
    try {
      await updateCardMut.mutateAsync({ id: card.id, patch: { status: s } });
    } catch (e: any) {
      return toast.error("Falha ao mudar status", { description: e?.message });
    }
    await logAtividade("status", { de: card.status, para: s });
    refetchCard();
    invalidateBoard();
  };

  const mudarPrazo = async (val: string) => {
    if (!card) return;
    const novo = val || null;
    try {
      await updateCardMut.mutateAsync({ id: card.id, patch: { prazo: novo } });
    } catch (e: any) {
      return toast.error("Falha ao salvar prazo", { description: e?.message });
    }
    await logAtividade("prazo", { para: novo });
    refetchCard();
    invalidateBoard();
  };

  const mudarResponsavel = async (val: string) => {
    if (!card) return;
    const novo = val === "__none" ? null : val;
    try {
      await updateCardMut.mutateAsync({ id: card.id, patch: { responsavel_id: novo } });
    } catch (e: any) {
      return toast.error("Falha ao atribuir", { description: e?.message });
    }
    const profile = profiles.find((p) => p.id === novo);
    await logAtividade("responsavel", { para_id: novo, para_nome: profile?.login ?? null });
    // notificação para o responsável
    if (novo) {
      await insertNotificacaoMut.mutateAsync({
        user_id: novo,
        tipo: "atribuicao",
        card_id: card.id,
        texto: `Você foi atribuído ao card #${card.numero} — ${card.titulo}`,
      });
    }
    refetchCard();
    invalidateBoard();
  };

  const addSetor = async (setor: string) => {
    if (!card || !setor) return;
    if (card.card_setores.some((s: any) => s.setor === setor)) return;
    const { error } = await insertCardSetorMut.mutateAsync({ card_id: card.id, setor });
    if (error) return toast.error("Falha ao adicionar setor", { description: error.message });
    await logAtividade("setor_add", { setor });
    refetchCard();
    invalidateBoard();
  };
  const removeSetor = async (setor: string) => {
    if (!card) return;
    const { error } = await removeCardSetorMut.mutateAsync({ cardId: card.id, setor });
    if (error) return toast.error("Falha ao remover setor", { description: error.message });
    await logAtividade("setor_remove", { setor });
    refetchCard();
    invalidateBoard();
  };

  const toggleLabel = async (label: LabelRow) => {
    if (!card) return;
    const has = card.card_label_links.some((l: any) => l.card_labels?.id === label.id);
    // Otimista — responde no clique sem esperar o servidor.
    const novoLinks = has
      ? card.card_label_links.filter((l: any) => l.card_labels?.id !== label.id)
      : [...card.card_label_links, { card_labels: label }];
    patchCardCache({ card_label_links: novoLinks });
    if (has) {
      const { error } = await removeCardLabelLinkMut.mutateAsync({ cardId: card.id, labelId: label.id });
      if (error) {
        patchCardCache({ card_label_links: card.card_label_links });
        return toast.error("Falha", { description: error.message });
      }
      await logAtividade("label_remove", { nome: label.nome });
    } else {
      const { error } = await insertCardLabelLinkMut.mutateAsync({ cardId: card.id, labelId: label.id });
      if (error) {
        patchCardCache({ card_label_links: card.card_label_links });
        return toast.error("Falha", { description: error.message });
      }
      await logAtividade("label_add", { nome: label.nome });
    }
    invalidateBoard();
  };

  // Checklist
  const addChecklistItemEm = async (grupo: string, texto?: string) => {
    const txt = (texto ?? novosPorGrupo[grupo] ?? "").trim();
    if (!txt || !cardId) return;
    const ordem = (checklist[checklist.length - 1]?.ordem ?? 0) + 1;
    const { error } = await insertChecklistItemMut.mutateAsync({
      cardId,
      payload: {
        card_id: cardId,
        texto: txt,
        ordem,
        grupo,
        concluido: false,
      },
    });
    if (error) return toast.error("Falha", { description: error.message });
    setNovosPorGrupo((m) => ({ ...m, [grupo]: "" }));
    await logAtividade("checklist_add", { texto: txt, grupo });
    refetchChecklist();
    invalidateBoard();
  };

  const criarNovoGrupoChecklist = async () => {
    if (!cardId) return;
    // Gera um nome único de placeholder e entra em modo de edição inline.
    const existentes = new Set<string>([
      ...checklist.map((i: any) => (i.grupo as string) || "Checklist"),
      ...Object.keys(novosPorGrupo),
    ]);
    let base = "Novo checklist";
    let nome = base;
    let n = 2;
    while (existentes.has(nome)) nome = `${base} ${n++}`;
    setNovosPorGrupo((m) => ({ ...m, [nome]: m[nome] ?? "" }));
    setNovoNomeGrupo(nome);
    setRenomeandoGrupo(nome);
  };

  const renomearGrupoChecklist = async (de: string, para: string) => {
    const novo = para.trim();
    if (!novo || novo === de || !cardId) return;
    const { error } = await updateChecklistGrupoMut.mutateAsync({ cardId, de, para: novo });
    if (error) return toast.error("Falha", { description: error.message });
    setNovosPorGrupo((m) => {
      const r = { ...m };
      r[novo] = r[de] ?? "";
      delete r[de];
      return r;
    });
    await logAtividade("checklist_rename", { de, para: novo });
    refetchChecklist();
  };

  const removerGrupoChecklist = async (grupo: string) => {
    if (!cardId) return;
    const itens = checklist.filter((i: any) => (i.grupo ?? "Checklist") === grupo);
    if (itens.length > 0) {
      setGrupoChecklistParaRemover({ grupo, total: itens.length });
      return;
    }
    await executarRemocaoGrupoChecklist(grupo);
  };

  const executarRemocaoGrupoChecklist = async (grupo: string) => {
    if (!cardId) return;
    const itens = checklist.filter((i: any) => (i.grupo ?? "Checklist") === grupo);
    if (itens.length > 0) {
      const { error } = await removeChecklistGrupoMut.mutateAsync({ cardId, grupo });
      if (error) return toast.error("Falha", { description: error.message });
    }
    setNovosPorGrupo((m) => {
      const r = { ...m };
      delete r[grupo];
      return r;
    });
    await logAtividade("checklist_group_remove", { grupo });
    refetchChecklist();
  };

  const toggleChecklist = async (item: any) => {
    const { error } = await setChecklistConcluidoMut.mutateAsync({ id: item.id, concluido: !item.concluido, cardId: cardId ?? undefined });
    if (error) return toast.error("Falha", { description: error.message });
    await logAtividade(item.concluido ? "checklist_undone" : "checklist_done", {
      texto: item.texto,
    });
    refetchChecklist();
    invalidateBoard();
  };

  const removeChecklist = async (item: any) => {
    const { error } = await removeChecklistItemMut.mutateAsync({ id: item.id, cardId: cardId ?? undefined });
    if (error) return toast.error("Falha", { description: error.message });
    refetchChecklist();
    invalidateBoard();
  };

  // REF.4: atualiza responsável/prazo de um item de checklist
  const atualizarItemChecklist = async (
    item: any,
    patch: { responsavel_id?: string | null; prazo?: string | null },
  ) => {
    const { error } = await updateChecklistItemMut.mutateAsync({ id: item.id, patch, cardId: cardId ?? undefined });
    if (error) return toast.error("Falha", { description: error.message });
    refetchChecklist();
  };

  // REF.4: múltiplos membros
  const addMembro = async (user_id: string) => {
    if (!cardId || !user_id) return;
    if (membros.includes(user_id)) return;
    const { error } = await insertCardMembroMut.mutateAsync({ cardId, userId: user_id });
    if (error) return toast.error("Falha ao adicionar membro", { description: error.message });
    const p = profiles.find((x) => x.id === user_id);
    await logAtividade("membro_add", { user_id, nome: p?.login ?? null });
    refetchMembros();
  };
  const removeMembro = async (user_id: string) => {
    if (!cardId) return;
    const { error } = await removeCardMembroMut.mutateAsync({ cardId, userId: user_id });
    if (error) return toast.error("Falha ao remover membro", { description: error.message });
    const p = profiles.find((x) => x.id === user_id);
    await logAtividade("membro_remove", { user_id, nome: p?.login ?? null });
    refetchMembros();
  };

  // Comentários (com @mention → notificação)
  const enviarComentario = async () => {
    const txt = novoComent.trim();
    if (!txt || !cardId || !card) return;
    const { error } = await insertCardComentarioMut.mutateAsync({
      cardId,
      payload: {
        card_id: cardId,
        autor: ator,
        texto: txt,
        reply_to: replyTo,
      },
    });
    if (error) return toast.error("Falha", { description: error.message });

    // Notificações: @menção + responsável (sem duplicar com o autor)
    const mencionados = extrairMencoes(txt);
    const alvos = new Map<string, { tipo: "mencao" | "comentario"; texto: string }>();
    if (mencionados.length) {
      profiles
        .filter((p) => p.login && mencionados.includes(p.login.toLowerCase()))
        .forEach((p) =>
          alvos.set(p.id, {
            tipo: "mencao",
            texto: `${ator} mencionou você em #${card.numero} — ${card.titulo}`,
          }),
        );
    }
    if (
      card.responsavel_id &&
      card.responsavel_id !== currentPlayer?.id &&
      !alvos.has(card.responsavel_id)
    ) {
      alvos.set(card.responsavel_id, {
        tipo: "comentario",
        texto: `${ator} comentou em #${card.numero} — ${card.titulo}`,
      });
    }
    if (alvos.size) {
      await insertNotificacoesMut.mutateAsync(
        Array.from(alvos.entries()).map(([user_id, n]) => ({
          user_id,
          tipo: n.tipo,
          card_id: cardId,
          texto: n.texto,
        })),
      );
    }
    setNovoComent("");
    setCursorPos(0);
    setReplyTo(null);
    await logAtividade("comentario", { resumo: txt.slice(0, 80) });
    refetchComents();
    invalidateBoard();
  };

  // Anexos (storage bucket card-anexos)
  const uploadAnexo = async (file: File) => {
    if (!cardId) return;
    setUploading(true);
    try {
      const safe = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${cardId}/${Date.now()}-${safe}`;
      const { error: upErr } = await cardAnexosStorage.upload(path, file, {
        contentType: file.type || undefined,
        upsert: false,
      });
      if (upErr) throw upErr;
      const { error: insErr } = await insertCardAnexoMut.mutateAsync({
        cardId,
        payload: {
          card_id: cardId,
          nome: file.name,
          storage_path: path,
          tamanho: file.size,
          mime: file.type || null,
          enviado_por: ator,
        },
      });
      if (insErr) throw insErr;
      await logAtividade("anexo_add", { nome: file.name });
      refetchAnexos();
      invalidateBoard();
    } catch (err: any) {
      toast.error("Falha ao enviar anexo", { description: err.message });
    } finally {
      setUploading(false);
    }
  };

  const baixarAnexo = async (anexo: any) => {
    const { data, error } = await cardAnexosStorage.createSignedUrl(anexo.storage_path, 60);
    if (error || !data) return toast.error("Falha ao gerar link", { description: error?.message });
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const removerAnexo = (anexo: any) => {
    setAnexoParaRemover(anexo);
  };

  const executarRemocaoAnexo = async (anexo: any) => {
    const { error: stErr } = await cardAnexosStorage.remove([anexo.storage_path]);
    if (stErr) return toast.error("Falha no storage", { description: stErr.message });
    const { error: dbErr } = await removeCardAnexoMut.mutateAsync({ id: anexo.id, cardId: cardId ?? undefined });
    if (dbErr) return toast.error("Falha no banco", { description: dbErr.message });
    await logAtividade("anexo_remove", { nome: anexo.nome });
    refetchAnexos();
    invalidateBoard();
  };

  const checklistPct = useMemo(() => {
    if (!checklist.length) return 0;
    return Math.round((checklist.filter((i) => i.concluido).length * 100) / checklist.length);
  }, [checklist]);

  function formatTamanho(b?: number | null): string {
    if (!b) return "";
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
    return `${(b / 1024 / 1024).toFixed(1)} MB`;
  }

  const numeroContrato = card ? numeroContratoVinculado(card) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[100vw] sm:max-w-4xl w-full h-[100dvh] sm:h-auto sm:max-h-[90vh] overflow-y-auto p-4 sm:p-6 rounded-none sm:rounded-lg">
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Carregando…</div>
        ) : isError ? (
          <div className="p-6 space-y-2">
            <div className="text-sm font-medium text-destructive">Falha ao carregar o card.</div>
            <div className="text-xs text-muted-foreground break-all">
              {(error as any)?.message ?? String(error)}
            </div>
          </div>
        ) : !card ? (
          <div className="p-6 space-y-2">
            <div className="text-sm font-medium">Card não encontrado.</div>
            <div className="text-xs text-muted-foreground">
              Ele pode ter sido arquivado ou você não tem permissão para visualizá-lo.
            </div>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 min-w-0">
                <span className="text-muted-foreground text-sm">#{card.numero}</span>
                {numeroContrato && (
                  <Badge variant="outline" className="shrink-0 text-[10px] font-mono">
                    Nº {numeroContrato}
                  </Badge>
                )}
                <Input
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  onBlur={salvarTitulo}
                  onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                  className="min-w-0 text-base font-semibold border-transparent hover:border-input focus-visible:border-input"
                />
                <MoverCopiarCardMenu cardId={cardId!} boardAtualId={boardAtualId} />
              </DialogTitle>
            </DialogHeader>

            {!canEdit && (
              <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 px-3 py-2 text-xs text-warning">
                <Lock className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{perms.reason ?? "Você não tem permissão para editar este card."}</span>
              </div>
            )}

            <RestricoesDoCardBadge cardId={cardId} />
            <RiscosDoCardBadge cardId={cardId} />
            <UltimoRdoBadge cardId={cardId} />

            <fieldset disabled={!canEdit} className="contents disabled:opacity-100">
              <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-4">
                {/* Corpo principal */}
                <div className="flex flex-col gap-4 min-w-0">
                  {/* Descrição (REF.4: markdown com view/edit) */}
                  <section>
                    <div className="flex items-center justify-between mb-1.5">
                      <h3 className="text-sm font-semibold flex items-center gap-1.5">
                        <AlignLeft className="h-4 w-4" /> Descrição
                      </h3>
                      {!editarDescricao && canEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => setEditarDescricao(true)}
                        >
                          <Pencil className="h-3 w-3 mr-1" /> Editar
                        </Button>
                      )}
                    </div>
                    {editarDescricao ? (
                      <div className="flex flex-col gap-1.5">
                        <RichTextEditor
                          value={descricao}
                          onChange={setDescricao}
                          placeholder="Descreva o card: **negrito**, listas, [links](https://...), citações…"
                          minHeight={140}
                          autoFocus
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setDescricao(card.descricao ?? "");
                              setEditarDescricao(false);
                            }}
                          >
                            Cancelar
                          </Button>
                          <Button
                            size="sm"
                            onClick={async () => {
                              await salvarDescricao();
                              setEditarDescricao(false);
                            }}
                          >
                            Salvar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className={cn(
                          "rounded-md border bg-muted/30 px-3 py-2 min-h-[60px]",
                          canEdit && "cursor-pointer hover:bg-muted/50 transition-colors",
                        )}
                        onClick={() => canEdit && setEditarDescricao(true)}
                      >
                        <MarkdownView source={descricao} />
                      </div>
                    )}
                  </section>

                  {/* Checklist (REF.4: responsável + prazo opcionais por item) */}
                  {vis.visivel("checklist") && (
                    <section>
                      <div className="flex items-center justify-between mb-1.5">
                        <h3 className="text-sm font-semibold flex items-center gap-1.5">
                          <CheckSquare className="h-4 w-4" /> Checklist
                        </h3>
                        <div className="flex items-center gap-2">
                          {checklist.length > 0 && (
                            <span className="text-xs text-muted-foreground">{checklistPct}%</span>
                          )}
                          {canEdit && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={criarNovoGrupoChecklist}
                              title="Adicionar outro checklist"
                            >
                              <Plus className="h-3.5 w-3.5 mr-1" /> Novo checklist
                            </Button>
                          )}
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-1.5 text-[10px]"
                              onClick={() => pedirRemocaoSecao("checklist")}
                              title="Remover seção"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                      {(() => {
                        // Agrupa itens por grupo (default "Checklist"); inclui grupos
                        // "vazios" que existem só no estado local (recém-criados).
                        const grupos = new Map<string, any[]>();
                        for (const it of checklist) {
                          const g = (it as any).grupo || "Checklist";
                          if (!grupos.has(g)) grupos.set(g, []);
                          grupos.get(g)!.push(it);
                        }
                        for (const g of Object.keys(novosPorGrupo)) {
                          if (!grupos.has(g)) grupos.set(g, []);
                        }
                        if (grupos.size === 0) grupos.set("Checklist", []);
                        return Array.from(grupos.entries()).map(([grupo, itens]) => {
                          const done = itens.filter((i: any) => i.concluido).length;
                          const pct = itens.length ? Math.round((done * 100) / itens.length) : 0;
                          const editandoTitulo = renomeandoGrupo === grupo;
                          return (
                            <div key={grupo} className="mb-3 border border-border/50 rounded p-2">
                              <div className="flex items-center justify-between mb-1.5 gap-2">
                                {editandoTitulo ? (
                                  <Input
                                    autoFocus
                                    value={novoNomeGrupo}
                                    onChange={(e) => setNovoNomeGrupo(e.target.value)}
                                    onBlur={async () => {
                                      await renomearGrupoChecklist(grupo, novoNomeGrupo);
                                      setRenomeandoGrupo(null);
                                    }}
                                    onKeyDown={async (e) => {
                                      if (e.key === "Enter") {
                                        await renomearGrupoChecklist(grupo, novoNomeGrupo);
                                        setRenomeandoGrupo(null);
                                      }
                                      if (e.key === "Escape") setRenomeandoGrupo(null);
                                    }}
                                    className="h-7 text-sm font-medium"
                                  />
                                ) : (
                                  <button
                                    type="button"
                                    disabled={!canEdit}
                                    className="text-sm font-medium hover:underline text-left flex-1 truncate"
                                    onClick={() => {
                                      setRenomeandoGrupo(grupo);
                                      setNovoNomeGrupo(grupo);
                                    }}
                                    title="Renomear checklist"
                                  >
                                    {grupo}
                                  </button>
                                )}
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  {itens.length > 0 && <span>{pct}%</span>}
                                  {canEdit && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      aria-label="Remover checklist"
                                      onClick={() => removerGrupoChecklist(grupo)}
                                      title="Remover checklist"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-col gap-1">
                                {itens.map((item: any) => {
                                  const resp = profiles.find((p) => p.id === item.responsavel_id);
                                  const prazoVencido =
                                    item.prazo &&
                                    !item.concluido &&
                                    new Date(item.prazo + "T00:00:00").getTime() <
                                      Date.now() - 86400000;
                                  return (
                                    <div key={item.id} className="flex items-center gap-2 group">
                                      <Checkbox
                                        checked={item.concluido}
                                        onCheckedChange={() => toggleChecklist(item)}
                                      />
                                      <span
                                        className={cn(
                                          "flex-1 text-sm",
                                          item.concluido && "line-through text-muted-foreground",
                                        )}
                                      >
                                        {item.texto}
                                      </span>
                                      {item.prazo && (
                                        <span
                                          className={cn(
                                            "inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded border",
                                            prazoVencido
                                              ? "border-destructive/40 text-destructive bg-destructive/10"
                                              : "border-border text-muted-foreground",
                                          )}
                                        >
                                          <CalendarDays className="h-3 w-3" />
                                          {item.prazo.split("-").reverse().slice(0, 2).join("/")}
                                        </span>
                                      )}
                                      {resp && (
                                        <Avatar className="h-5 w-5" title={resp.login ?? ""}>
                                          <AvatarFallback className="text-[9px]">
                                            {iniciais(resp.login ?? "")}
                                          </AvatarFallback>
                                        </Avatar>
                                      )}
                                      <Popover>
                                        <PopoverTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 opacity-0 group-hover:opacity-100"
                                            title="Responsável e prazo"
                                            aria-label="Responsável e prazo"
                                          >
                                            <UserCircle2 className="h-3.5 w-3.5" />
                                          </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-64 p-2 space-y-2" align="end">
                                          <div>
                                            <div className="text-[10px] font-semibold text-muted-foreground mb-1">
                                              Responsável
                                            </div>
                                            <Select
                                              value={item.responsavel_id ?? "__none"}
                                              onValueChange={(v) =>
                                                atualizarItemChecklist(item, {
                                                  responsavel_id: v === "__none" ? null : v,
                                                })
                                              }
                                            >
                                              <SelectTrigger className="h-8 text-xs">
                                                <SelectValue placeholder="—" />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="__none">Ninguém</SelectItem>
                                                {profilesSelecionaveis.map((p) => (
                                                  <SelectItem key={p.id} value={p.id}>
                                                    {p.login}
                                                  </SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          </div>
                                          <div>
                                            <div className="text-[10px] font-semibold text-muted-foreground mb-1">
                                              Prazo
                                            </div>
                                            <Input
                                              type="date"
                                              className="h-8 text-xs"
                                              value={item.prazo ?? ""}
                                              onChange={(e) =>
                                                atualizarItemChecklist(item, {
                                                  prazo: e.target.value || null,
                                                })
                                              }
                                            />
                                          </div>
                                        </PopoverContent>
                                      </Popover>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 opacity-0 group-hover:opacity-100"
                                        onClick={() => removeChecklist(item)}
                                        aria-label="Remover item do checklist"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  );
                                })}
                                {canEdit && (
                                  <div className="flex items-center gap-2 mt-1">
                                    <Input
                                      value={novosPorGrupo[grupo] ?? ""}
                                      onChange={(e) =>
                                        setNovosPorGrupo((m) => ({ ...m, [grupo]: e.target.value }))
                                      }
                                      onKeyDown={(e) =>
                                        e.key === "Enter" && addChecklistItemEm(grupo)
                                      }
                                      placeholder="Adicionar item…"
                                      className="h-8"
                                    />
                                    <Button
                                      size="sm"
                                      onClick={() => addChecklistItemEm(grupo)}
                                      disabled={!(novosPorGrupo[grupo] ?? "").trim()}
                                    >
                                      <Plus className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </section>
                  )}

                  {/* Anexos */}
                  {vis.visivel("anexos") && (
                    <section>
                      <div className="flex items-center justify-between mb-1.5">
                        <h3 className="text-sm font-semibold flex items-center gap-1.5">
                          <Paperclip className="h-4 w-4" /> Anexos ({anexos.length})
                        </h3>
                        <div className="flex items-center gap-1">
                          <label className="inline-flex">
                            <input
                              type="file"
                              className="hidden"
                              disabled={uploading}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) uploadAnexo(f);
                                e.target.value = "";
                              }}
                            />
                            <Button asChild size="sm" variant="outline" disabled={uploading}>
                              <span className="cursor-pointer inline-flex items-center gap-1">
                                <Upload className="h-3.5 w-3.5" />
                                {uploading ? "Enviando…" : "Enviar"}
                              </span>
                            </Button>
                          </label>
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-1.5 text-[10px]"
                              onClick={() => pedirRemocaoSecao("anexos")}
                              title="Remover seção"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        {anexos.map((a: any) => (
                          <div
                            key={a.id}
                            className="flex items-center gap-2 text-sm border rounded px-2 py-1.5 group"
                          >
                            <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                            <button
                              onClick={() => baixarAnexo(a)}
                              className="flex-1 text-left truncate hover:underline"
                              title={a.nome}
                            >
                              {a.nome}
                            </button>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {formatTamanho(a.tamanho)}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 opacity-0 group-hover:opacity-100"
                              onClick={() => baixarAnexo(a)}
                              aria-label="Baixar anexo"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 opacity-0 group-hover:opacity-100"
                              onClick={() => removerAnexo(a)}
                              aria-label="Remover anexo"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                        {anexos.length === 0 && (
                          <p className="text-xs text-muted-foreground">Nenhum anexo.</p>
                        )}
                      </div>
                    </section>
                  )}

                  <Separator />

                  {/* Tabs: Comentários / Atividade */}
                  <CardCamposCustom cardId={cardId!} boardId={boardAtualId} />
                  <CardVinculosSection
                    cardId={cardId!}
                    boardId={boardAtualId}
                    podeEditar={canEdit}
                  />
                  <Tabs defaultValue="coments">
                    <TabsList>
                      <TabsTrigger value="coments" className="gap-1.5">
                        <MessageSquare className="h-4 w-4" /> Comentários ({comentarios.length})
                      </TabsTrigger>
                      <TabsTrigger value="atividade" className="gap-1.5">
                        <History className="h-4 w-4" /> Atividade
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="coments" className="flex flex-col gap-3">
                      {/* Toggle mostrar/ocultar detalhes (Fase F) */}
                      <div className="flex items-center justify-end -mb-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1.5"
                          onClick={() => setMostrarDetalhes((v) => !v)}
                          aria-pressed={mostrarDetalhes}
                          title={mostrarDetalhes ? "Ocultar detalhes" : "Mostrar detalhes"}
                        >
                          {mostrarDetalhes ? (
                            <>
                              <EyeOff className="h-3.5 w-3.5" /> Ocultar detalhes
                            </>
                          ) : (
                            <>
                              <Eye className="h-3.5 w-3.5" /> Mostrar detalhes
                            </>
                          )}
                        </Button>
                      </div>
                      {(() => {
                        return (
                          <div className="flex gap-2 items-start">
                            <Avatar className="h-7 w-7 mt-0.5">
                              <AvatarFallback className="text-[10px]">
                                {iniciais(ator)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 flex flex-col gap-1 relative">
                              {replyTo &&
                                (() => {
                                  const pai = resolverPai(comentarios, replyTo) as
                                    (typeof comentarios)[number] | null;
                                  return (
                                    <div className="flex items-start gap-2 rounded-md border border-dashed bg-muted/40 px-2 py-1.5 text-xs">
                                      <CornerUpLeft className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                                      <div className="flex-1 min-w-0">
                                        <div className="text-muted-foreground">
                                          Respondendo a{" "}
                                          <span className="font-medium text-foreground">
                                            {pai?.autor ?? "comentário removido"}
                                          </span>
                                        </div>
                                        <div className="truncate text-foreground/80">
                                          {pai ? resumoCitacao(pai.texto) : <em>(indisponível)</em>}
                                        </div>
                                      </div>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 shrink-0"
                                        onClick={() => setReplyTo(null)}
                                        title="Cancelar resposta"
                                        aria-label="Cancelar resposta"
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  );
                                })()}
                              <CommentEditor
                                value={novoComent}
                                onChange={setNovoComent}
                                onSubmit={enviarComentario}
                                profiles={profiles}
                                cardId={cardId}
                                ator={ator}
                                onAnexoCriado={() => {
                                  refetchAnexos();
                                  invalidateBoard();
                                }}
                              />
                              <div className="flex justify-end">
                                <Button
                                  size="sm"
                                  onClick={enviarComentario}
                                  disabled={!novoComent.trim()}
                                >
                                  Comentar
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                      {(() => {
                        const itens = montarTimeline(comentarios, atividades, {
                          detalhes: mostrarDetalhes,
                        });
                        if (itens.length === 0) {
                          return (
                            <div className="text-xs text-muted-foreground italic py-2">
                              Nenhum comentário ainda.
                            </div>
                          );
                        }
                        return itens.map((it) => {
                          if (it.kind === "comentario") {
                            const c = it.data;
                            const pai = resolverPai(comentarios, c.reply_to);
                            return (
                              <div key={`c-${c.id}`} className="flex gap-2 items-start group">
                                <Avatar className="h-7 w-7 mt-0.5">
                                  <AvatarFallback className="text-[10px]">
                                    {iniciais(c.autor)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                                    <span className="font-medium text-foreground">{c.autor}</span>
                                    <span>·</span>
                                    <span>{formatDataHora(c.created_at)}</span>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-1.5 text-[11px] ml-auto opacity-0 group-hover:opacity-100 focus:opacity-100"
                                      onClick={() => {
                                        setReplyTo(c.id);
                                        requestAnimationFrame(() => comentRef.current?.focus());
                                      }}
                                      title="Responder"
                                      aria-label={`Responder a ${c.autor}`}
                                    >
                                      <CornerUpLeft className="h-3 w-3 mr-1" /> Responder
                                    </Button>
                                  </div>
                                  {pai && (
                                    <div className="mt-1 border-l-2 border-muted pl-2 text-[11px] text-muted-foreground">
                                      <span className="font-medium text-foreground/80">
                                        {pai.autor}:
                                      </span>{" "}
                                      {resumoCitacao(pai.texto, 100)}
                                    </div>
                                  )}
                                  <MarkdownView source={c.texto} />
                                </div>
                              </div>
                            );
                          }
                          // Atividade intercalada (modo detalhes)
                          const a = it.data;
                          const Icon = iconeEvento(a.evento);
                          return (
                            <div key={`a-${a.id}`} className="flex items-start gap-2 text-xs pl-1">
                              <div className="mt-0.5 h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                                <Icon className="h-3 w-3 text-muted-foreground" />
                              </div>
                              <div className="flex-1 min-w-0 leading-snug text-muted-foreground">
                                <span className="font-medium text-foreground">{a.ator_nome}</span>{" "}
                                {descreverAtividade(a.evento, a.detalhe)}
                              </div>
                              <span className="text-[10px] text-muted-foreground shrink-0">
                                {formatDataHora(a.created_at)}
                              </span>
                            </div>
                          );
                        });
                      })()}
                    </TabsContent>
                    <TabsContent value="atividade" className="flex flex-col gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Filtrar:</span>
                        <Select value={filtroAtividade} onValueChange={setFiltroAtividade}>
                          <SelectTrigger className="h-7 w-44 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__all">Tudo</SelectItem>
                            <SelectItem value="status">Status</SelectItem>
                            <SelectItem value="prazo">Prazo</SelectItem>
                            <SelectItem value="responsavel">Responsável</SelectItem>
                            <SelectItem value="etiquetas">Etiquetas/Setores</SelectItem>
                            <SelectItem value="checklist">Checklist</SelectItem>
                            <SelectItem value="comentarios">Comentários</SelectItem>
                            <SelectItem value="anexos">Anexos</SelectItem>
                            <SelectItem value="outros">Outros</SelectItem>
                          </SelectContent>
                        </Select>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {atividades.length} eventos
                        </span>
                      </div>
                      {(() => {
                        const filtradas = atividades.filter((a) =>
                          filtroAtividade === "__all"
                            ? true
                            : categoriaEvento(a.evento) === filtroAtividade,
                        );
                        if (filtradas.length === 0) {
                          return (
                            <div className="text-xs text-muted-foreground italic py-4 text-center">
                              {atividades.length === 0
                                ? "Sem atividade registrada."
                                : "Nenhum evento neste filtro."}
                            </div>
                          );
                        }
                        const grupos = new Map<string, typeof filtradas>();
                        for (const a of filtradas) {
                          const dia = fmtDiaExtenso(a.created_at);
                          if (!grupos.has(dia)) grupos.set(dia, []);
                          grupos.get(dia)!.push(a);
                        }
                        return Array.from(grupos.entries()).map(([dia, items]) => (
                          <div key={dia} className="flex flex-col gap-1.5">
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold sticky top-0 bg-background py-1">
                              {dia}
                            </div>
                            {items.map((a) => {
                              const Icon = iconeEvento(a.evento);
                              const hora = new Date(a.created_at).toLocaleTimeString("pt-BR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              });
                              return (
                                <div key={a.id} className="flex items-start gap-2 text-xs">
                                  <div className="mt-0.5 h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                                    <Icon className="h-3 w-3 text-muted-foreground" />
                                  </div>
                                  <div className="flex-1 min-w-0 leading-snug">
                                    <span className="font-medium text-foreground">
                                      {a.ator_nome}
                                    </span>{" "}
                                    <span className="text-muted-foreground">
                                      {descreverAtividade(a.evento, a.detalhe)}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-muted-foreground shrink-0">
                                    {hora}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ));
                      })()}
                    </TabsContent>
                  </Tabs>
                </div>

                {/* Rail lateral */}
                <aside className="flex flex-col gap-3">
                  {/* H1 — Adicionar ao cartão (Trello "Add to card") */}
                  {canEdit && vis.adicionaveis().length > 0 && (
                    <div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="w-full justify-start">
                            <Plus className="h-4 w-4" /> Adicionar ao cartão
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-56">
                          <DropdownMenuLabel className="text-[10px] text-muted-foreground">
                            Seções disponíveis
                          </DropdownMenuLabel>
                          {vis.adicionaveis().map((s) => (
                            <DropdownMenuItem key={s} onClick={() => adicionarSecao(s)}>
                              {SECAO_LABEL[s]}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}

                  {/* Status */}
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-1">Status</div>
                    <Select
                      value={card.status}
                      onValueChange={(v) => mudarStatus(v as StatusGenerico)}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_GENERICO.map((s) => (
                          <SelectItem key={s.key} value={s.key}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Capa (REF.A) */}
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-1">Capa</div>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          disabled={!canEdit}
                          className="w-full h-8 rounded border border-border/60 overflow-hidden flex items-center gap-2 px-2 text-xs hover:bg-muted disabled:opacity-60"
                          title="Escolher capa"
                        >
                          {card.capa_url ? (
                            <img
                              src={card.capa_url}
                              alt=""
                              className="h-5 w-8 object-cover rounded-sm bg-muted"
                            />
                          ) : card.capa_cor ? (
                            <span
                              aria-hidden
                              className={cn(
                                "h-5 w-8 rounded-sm border border-border/60",
                                !isHexCor(card.capa_cor) && card.capa_cor,
                              )}
                              style={
                                isHexCor(card.capa_cor)
                                  ? { backgroundColor: card.capa_cor! }
                                  : undefined
                              }
                            />
                          ) : (
                            <span
                              aria-hidden
                              className="h-5 w-8 rounded-sm border border-dashed border-border/60"
                            />
                          )}
                          <span className="flex-1 text-left truncate">
                            {card.capa_url
                              ? "Imagem do anexo"
                              : card.capa_cor
                                ? "Cor selecionada"
                                : "Escolher cor…"}
                          </span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-2" align="start">
                        <div className="grid grid-cols-9 gap-1">
                          {CAPA_CORES.map((c) => {
                            const hex = isHexCor(c.value);
                            const selected = card.capa_cor === c.value && !card.capa_url;
                            return (
                              <button
                                key={c.value}
                                type="button"
                                disabled={!canEdit}
                                onClick={() => mudarCapa({ capa_cor: c.value, capa_url: null })}
                                aria-label={`Cor ${c.label}`}
                                title={c.label}
                                style={hex ? { backgroundColor: c.value } : undefined}
                                className={cn(
                                  "h-5 w-5 rounded border border-border/60",
                                  !hex && c.value,
                                  selected && "ring-2 ring-ring",
                                )}
                              />
                            );
                          })}
                        </div>
                        {(card.capa_cor || card.capa_url) && (
                          <button
                            type="button"
                            disabled={!canEdit}
                            onClick={() => mudarCapa({ capa_cor: null, capa_url: null })}
                            className="mt-2 w-full h-7 rounded border border-border/60 text-[11px] hover:bg-muted"
                          >
                            Remover capa
                          </button>
                        )}
                      </PopoverContent>
                    </Popover>
                    {anexosImagem.length > 0 && (
                      <Select
                        value=""
                        onValueChange={(v) => {
                          const a = anexosImagem.find((x: any) => x.id === v);
                          if (a) void usarAnexoComoCapa(a);
                        }}
                      >
                        <SelectTrigger className="h-7 text-xs mt-1.5" disabled={!canEdit}>
                          <SelectValue placeholder="Usar anexo como capa…" />
                        </SelectTrigger>
                        <SelectContent>
                          {anexosImagem.map((a: any) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* Responsável */}
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                      <UserCircle2 className="h-3.5 w-3.5" /> Responsável
                    </div>
                    <Select
                      value={card.responsavel_id ?? "__none"}
                      onValueChange={mudarResponsavel}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">Ninguém</SelectItem>
                        {profilesSelecionaveis.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.login}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Membros (REF.4: múltiplos) */}
                  {vis.visivel("membros") && (
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground mb-1 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" /> Membros
                        </span>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => pedirRemocaoSecao("membros")}
                            title="Remover seção"
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 mb-1">
                        {membros.length === 0 && (
                          <span className="text-[11px] text-muted-foreground italic">
                            Nenhum membro extra
                          </span>
                        )}
                        {membros.map((uid) => {
                          const p = profiles.find((x) => x.id === uid);
                          const nome = p?.login ?? "—";
                          // Sair do próprio card não exige permissão de edição.
                          const podeRemover = canEdit || souEuMembro(uid);
                          return (
                            <button
                              key={uid}
                              type="button"
                              onClick={() => podeRemover && removeMembro(uid)}
                              className="inline-flex items-center gap-1 rounded-full bg-muted hover:bg-destructive/10 px-1.5 py-0.5 text-[11px]"
                              title={
                                podeRemover
                                  ? souEuMembro(uid) && !canEdit
                                    ? "Sair do cartão"
                                    : `Remover ${nome}`
                                  : nome
                              }
                            >
                              <Avatar className="h-4 w-4">
                                <AvatarFallback className="text-[8px]">
                                  {iniciais(nome)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="max-w-[80px] truncate">{nome}</span>
                              {podeRemover && <X className="h-3 w-3 text-muted-foreground" />}
                            </button>
                          );
                        })}

                      </div>
                      <Select value="" onValueChange={addMembro}>
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue placeholder="+ Adicionar membro" />
                        </SelectTrigger>
                        <SelectContent>
                          {profilesSelecionaveis
                            .filter((p) => !membros.includes(p.id) && p.id !== card.responsavel_id)
                            .map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.login}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Prazo */}
                  {vis.visivel("datas") && (
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground mb-1 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" /> Prazo
                        </span>
                        {!vis.temDado("datas") && !(card as any)?.cronograma_item_id && canEdit && (
                          <button
                            type="button"
                            onClick={() => pedirRemocaoSecao("datas")}
                            title="Remover seção"
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <Input
                        type="date"
                        className="h-8"
                        value={card.prazo ?? ""}
                        onChange={(e) => mudarPrazo(e.target.value)}
                        disabled={!!(card as any)?.cronograma_item_id}
                      />
                    </div>
                  )}

                  {/* H3 — Etapa do cronograma */}
                  {vis.visivel("cronograma") && (
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground mb-1 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" /> Etapa do cronograma
                        </span>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => pedirRemocaoSecao("cronograma")}
                            title="Remover seção"
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      {card?.obra_id ? (
                        <CronogramaEtapaPicker
                          itens={cronogramaItens as any}
                          value={(card as any)?.cronograma_item_id ?? null}
                          disabled={!canEdit}
                          onChange={async (novo) => {
                            try {
                              await updateCardMut.mutateAsync({ id: card.id, patch: { cronograma_item_id: novo } as any });
                            } catch (e: any) {
                              toast.error(e?.message);
                              return;
                            }
                            await logAtividade("outros", {
                              campo: "cronograma_item_id",
                              para: novo,
                            });
                            qc.invalidateQueries({ queryKey: ["card-generico", card.id] });
                          }}
                        />
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Defina a obra do card para vincular uma etapa.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Lembrete */}
                  {vis.visivel("lembrete") && (
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground mb-1 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" /> Lembrete
                        </span>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => pedirRemocaoSecao("lembrete")}
                            title="Remover seção"
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <Input
                        type="datetime-local"
                        className="h-8"
                        value={
                          card.lembrete ? new Date(card.lembrete).toISOString().slice(0, 16) : ""
                        }
                        onChange={async (e) => {
                          const v = e.target.value ? new Date(e.target.value).toISOString() : null;
                          try {
                            await updateCardMut.mutateAsync({ id: card.id, patch: { lembrete: v } });
                          } catch (e: any) {
                            return toast.error(e?.message);
                          }
                          await logAtividade("outros", { campo: "lembrete", para: v });
                          qc.invalidateQueries({ queryKey: ["card-generico", card.id] });
                        }}
                      />
                    </div>
                  )}

                  {/* Local */}
                  {vis.visivel("local") && (
                    <div>
                      {canEdit && (
                        <div className="flex justify-end mb-1">
                          <button
                            type="button"
                            onClick={() => pedirRemocaoSecao("local")}
                            title="Remover seção"
                            className="text-muted-foreground hover:text-foreground text-[10px]"
                          >
                            <X className="h-3 w-3 inline" /> remover
                          </button>
                        </div>
                      )}
                      <CardLocalSection cardId={card.id} readOnly={!canEdit} />
                    </div>
                  )}

                  {/* Setores */}
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" /> Setores
                    </div>
                    <div className="flex flex-wrap gap-1 mb-1">
                      {card.card_setores.map((s: any) => (
                        <Badge
                          key={s.setor}
                          variant="outline"
                          className="text-[10px] gap-1 cursor-pointer hover:bg-destructive/10"
                          onClick={() => removeSetor(s.setor)}
                          title="Clique para remover"
                        >
                          {s.setor} ×
                        </Badge>
                      ))}
                    </div>
                    <Select value="" onValueChange={addSetor}>
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="+ Adicionar setor" />
                      </SelectTrigger>
                      <SelectContent>
                        {SETORES_PADRAO.filter(
                          (s) => !card.card_setores.some((cs: any) => cs.setor === s),
                        ).map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Etiquetas */}
                  {vis.visivel("etiquetas") && (
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground mb-1 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Tag className="h-3.5 w-3.5" /> Etiquetas
                        </span>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => pedirRemocaoSecao("etiquetas")}
                            title="Remover seção"
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {labels.map((l) => {
                          const ativo = card.card_label_links.some(
                            (cl: any) => cl.card_labels?.id === l.id,
                          );
                          return (
                            <button
                              key={l.id}
                              onClick={() => toggleLabel(l)}
                              className={cn(
                                "px-2 py-0.5 rounded text-[10px] font-medium border transition-opacity",
                                !ativo && "opacity-50 hover:opacity-100",
                              )}
                              style={{ backgroundColor: l.cor, color: "#fff", borderColor: l.cor }}
                            >
                              {l.nome}
                            </button>
                          );
                        })}
                        {labels.length === 0 && (
                          <span className="text-xs text-muted-foreground">
                            Nenhuma etiqueta cadastrada
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </aside>
              </div>
            </fieldset>
          </>
        )}
      </DialogContent>
      <AlertDialog open={!!secaoParaRemover} onOpenChange={(o) => !o && setSecaoParaRemover(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover seção</AlertDialogTitle>
            <AlertDialogDescription>
              {secaoParaRemover && (
                <>
                  A seção <strong>{SECAO_LABEL[secaoParaRemover]}</strong> tem informações
                  preenchidas. Ao removê-la, esses dados serão excluídos. Deseja continuar?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarRemocaoSecao}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={!!grupoChecklistParaRemover}
        onOpenChange={(o) => !o && setGrupoChecklistParaRemover(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover checklist</AlertDialogTitle>
            <AlertDialogDescription>
              {grupoChecklistParaRemover && (
                <>
                  O checklist <strong>{grupoChecklistParaRemover.grupo}</strong> tem{" "}
                  {grupoChecklistParaRemover.total} item(ns) que serão excluídos. Continuar?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const g = grupoChecklistParaRemover?.grupo;
                setGrupoChecklistParaRemover(null);
                if (g) await executarRemocaoGrupoChecklist(g);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={!!anexoParaRemover} onOpenChange={(o) => !o && setAnexoParaRemover(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover anexo</AlertDialogTitle>
            <AlertDialogDescription>
              {anexoParaRemover && (
                <>
                  Remover o anexo <strong>{anexoParaRemover.nome}</strong>? Esta ação não pode ser
                  desfeita.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const a = anexoParaRemover;
                setAnexoParaRemover(null);
                if (a) await executarRemocaoAnexo(a);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

/* =====================================================================
 * CronogramaEtapaPicker — seleção com hierarquia + busca por código/nome.
 *
 * O esquema de `cronograma_itens` não tem coluna `codigo`/`parent_id`,
 * mas a `descricao` segue o padrão "<codigo dotted> <nome>", então
 * derivamos código e profundidade a partir dela.
 * ===================================================================== */
type EtapaItem = {
  id: string;
  descricao: string | null;
  data_inicio: string;
  data_fim: string;
  ordem: number;
};

function parseEtapa(desc: string | null): { codigo: string; nome: string; depth: number } {
  const raw = (desc ?? "").trim();
  const m = raw.match(/^(\d+(?:\.\d+)*)\s+(.*)$/);
  if (!m) return { codigo: "", nome: raw || "(sem descrição)", depth: 0 };
  const codigo = m[1];
  const nome = m[2].replace(/\s+·\s+\[.*\]\s*$/, "").trim();
  const depth = (codigo.match(/\./g) ?? []).length;
  return { codigo, nome, depth };
}

function CronogramaEtapaPicker({
  itens,
  value,
  disabled,
  onChange,
}: {
  itens: EtapaItem[];
  value: string | null;
  disabled?: boolean;
  onChange: (v: string | null) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const selecionado = useMemo(() => itens.find((i) => i.id === value) ?? null, [itens, value]);
  const labelSelecionado = useMemo(() => {
    if (!selecionado) return "";
    const { codigo, nome } = parseEtapa(selecionado.descricao);
    return codigo ? `${codigo} — ${nome}` : nome;
  }, [selecionado]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal h-8",
            !selecionado && "text-muted-foreground",
          )}
        >
          <span className="truncate text-xs">{labelSelecionado || "Selecionar etapa…"}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[360px]" align="start">
        <Command
          filter={(itemValue, search) => {
            const q = search.toLowerCase().trim();
            if (!q) return 1;
            return itemValue.toLowerCase().includes(q) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Buscar por código ou nome…" />
          <CommandList className="max-h-[320px]">
            <CommandEmpty>Nenhuma etapa encontrada.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="sem vinculo nenhum nada"
                onSelect={() => {
                  void onChange(null);
                  setOpen(false);
                }}
              >
                <span className="text-muted-foreground italic">— sem vínculo —</span>
              </CommandItem>
              {itens.map((it) => {
                const { codigo, nome, depth } = parseEtapa(it.descricao);
                const searchable = `${codigo} ${nome} ${it.descricao ?? ""}`;
                return (
                  <CommandItem
                    key={it.id}
                    value={searchable}
                    onSelect={() => {
                      void onChange(it.id);
                      setOpen(false);
                    }}
                    className="!py-1.5"
                  >
                    <div
                      className="flex items-start gap-2 w-full"
                      style={{ paddingLeft: `${Math.min(depth, 5) * 12}px` }}
                    >
                      {codigo && (
                        <span className="text-[10px] font-mono text-muted-foreground shrink-0 mt-0.5">
                          {codigo}
                        </span>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs truncate">{nome}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {it.data_inicio} → {it.data_fim}
                        </div>
                      </div>
                      {value === it.id && <Check className="h-3.5 w-3.5 shrink-0" />}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
