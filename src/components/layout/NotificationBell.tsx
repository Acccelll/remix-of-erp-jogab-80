import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Bell,
  Filter,
  ChevronDown,
  CheckCheck,
  FileSignature,
  CalendarClock,
  Settings2,
  DatabaseZap,
  Wrench,
  MessageSquare,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { usePermissions } from "@/contexts/auth/usePermissions";
import { useDocumentosContext } from "@/contexts/DocumentosContext";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  fetchNotificacoes,
  filtrarNotificacoesPorSetor,
  marcarComoLida,
  criarNotificacao,
  type Notificacao,
  type RoleScope,
} from "@/lib/notificacoes";
import { podePlayerVerSetorFinanceiro } from "@/lib/authz/paginas";

import { fmtDataLocal, fmtDataHora } from "@/lib/core/date";
import { swallow } from "@/lib/core/errors";
import { STORAGE_KEYS } from "@/lib/core/storage/keys";
import { useContratosVencendo } from "@/hooks/contratos/useContratosVencendo";
import { useContratoAlertaSilencio } from "@/hooks/contratos/useContratoAlertaSilencio";
import { useContratoDocumentosVencendo } from "@/hooks/contratos/useContratoDocumentosVencendo";
import { useContratosContext } from "@/contexts/ContratosContext";
import { useCrmTarefas, classificarTarefa } from "@/hooks/crm/useCrmTarefas";
import { useClientesContext } from "@/contexts/ClientesContext";
import { useNCPendentes } from "@/hooks/qualidade/useNCPendentes";
import { ShieldAlert } from "lucide-react";
import {
  NOTIF_CATEGORIAS,
  useNotifPreferencias,
} from "@/hooks/useNotifPreferencias";
import { useTotvsImportStatus, CADENCIA_LABEL } from "@/hooks/financeiro/useTotvsImportStatus";
import { usePreventivasFrota } from "@/hooks/frotas/usePreventivasFrota";
import { useSnapshotVelho } from "@/hooks/financeiro/useSnapshotVelho";
import { useMedicoesAguardandoAprovacao } from "@/hooks/financeiro/useMedicoesAguardandoAprovacao";
import { ClipboardCheck } from "lucide-react";
import { useObrasContext } from "@/contexts/ObrasContext";
import { getDocumentoNumeroLocal } from "@/lib/empresa/documento-numeracao-local";

const numeroContrato = (id: string) =>
  getDocumentoNumeroLocal(id, "contrato")?.numero ??
  `CTR-${id.slice(-6).toUpperCase()}`;



const STORAGE_KEY = STORAGE_KEYS.notifBellTiposOcultos;

const NotificationBell = () => {
  const { hasAccess, currentPlayer } = usePermissions();
  const { getExpiringDocuments } = useDocumentosContext();
  const { oportunidades } = useClientesContext();
  const { isVisivel, alternar, mostrarTodas, ocultarTodas, ocultas } =
    useNotifPreferencias();

  const canSeeRhDocs = hasAccess("rh", "editar");
  const allExpiring = getExpiringDocuments();
  const expiring =
    canSeeRhDocs && isVisivel("documentos_vencendo")
      ? allExpiring.filter((e) => e.documento.nome === "Férias")
      : [];
  const canSeeContratos = hasAccess("contratos", "visualizar");
  const contratosAlertaTodos = useContratosVencendo();
  const { filtrar: filtrarContratosSilenciados, mapa: silenciadosMapa, reativar: reativarSilencio } =
    useContratoAlertaSilencio();
  const contratosAlerta =
    canSeeContratos && isVisivel("contratos_vencendo")
      ? filtrarContratosSilenciados(contratosAlertaTodos)
      : [];

  const { contratos: contratosCtx } = useContratosContext();
  const contratosNomeMap = useMemo(() => {
    const m = new Map<string, string>();
    contratosCtx.forEach((c) => m.set(c.id, c.locacaoServico));
    return m;
  }, [contratosCtx]);
  const contratoDocsVencendo = useContratoDocumentosVencendo(
    30,
    canSeeContratos && isVisivel("contratos_documentos_vencendo"),
  );

  const canSeeCrm = hasAccess("crm", "visualizar");
  // Sem o módulo CRM não há o que buscar — o servidor recusa a rota e o alerta
  // já era filtrado por `canSeeCrm` logo abaixo.
  const {
    todas: crmTarefas,
    alternar: alternarTarefaCrm,
    adiar: adiarTarefaCrm,
  } = useCrmTarefas(undefined, canSeeCrm);
  const oportNome = useMemo(() => {
    const m = new Map<string, string>();
    oportunidades.forEach((o) => m.set(o.id, o.nome));
    return m;
  }, [oportunidades]);
  const hojeISO = new Date().toISOString().slice(0, 10);
  const followupsAlerta = useMemo(() => {
    if (!canSeeCrm || !isVisivel("followups_crm")) return [];
    return crmTarefas
      .filter((t) => t.status === "aberta")
      .filter((t) => classificarTarefa(t, hojeISO) !== "futura")
      .sort((a, b) => a.data.localeCompare(b.data));
  }, [crmTarefas, canSeeCrm, isVisivel, hojeISO]);

  const { alertas: ncAlertas } = useNCPendentes(
    7,
    !!currentPlayer && isVisivel("nc_pendentes"),
  );

  const canSeeFin =
    !!currentPlayer &&
    (currentPlayer.isGM ||
      currentPlayer.acessos?.financeiro === "financeiro" ||
      currentPlayer.acessos?.financeiro === "compras");
  const totvsImport = useTotvsImportStatus(canSeeFin && isVisivel("totvs_import_atrasado"));
  const totvsAlerta =
    canSeeFin &&
    isVisivel("totvs_import_atrasado") &&
    (totvsImport.status === "atrasada" || totvsImport.status === "vence_hoje")
      ? totvsImport
      : null;

  const canSeeFrotas = hasAccess("frotas", "visualizar");
  const preventivasAlerta = usePreventivasFrota(
    canSeeFrotas && isVisivel("preventiva_frota"),
  );

  const snapshotVelho = useSnapshotVelho(canSeeFin && isVisivel("snapshot_velho"));

  const canAprovarMedicao = hasAccess("obras_div", "editar");
  const { obras } = useObrasContext();
  const obrasNomeMap = useMemo(() => {
    const m = new Map<string, string>();
    obras.forEach((o) => m.set(o.id, o.nome));
    return m;
  }, [obras]);
  const medicoesPendentes = useMedicoesAguardandoAprovacao(
    canAprovarMedicao && isVisivel("medicao_aguardando_aprovacao"),
  );

  // PRO-030 slice-03 — emite NCs pendentes / aguardando reinspeção como notificação persistente
  // (dedupe client-side por chave estável). Escopo `compras` por proximidade operacional
  // até termos escopo `qualidade` (ver decisão PRO-030).
  useEffect(() => {
    for (const nc of ncAlertas) {
      if (nc.situacao !== "vencida" && nc.situacao !== "aguardando_reinspecao") continue;
      const dedupeKey = `nc:${nc.id}:${nc.situacao}`;
      const rotulo = nc.situacao === "aguardando_reinspecao" ? "Aguardando reinspeção" : "Prazo vencido";
      void criarNotificacao({
        tipo: "nc_pendente",
        role_scope: "compras",
        target_id: nc.id,
        titulo: `NC ${nc.codigo ?? ""}: ${rotulo}`.trim(),
        mensagem: nc.titulo,
        dedupeKey,
      });
    }
  }, [ncAlertas]);

  // PRO-030 slice-03 — preventivas de frota em faixa `vencida` viram notificação persistente.
  useEffect(() => {
    for (const p of preventivasAlerta) {
      if (p.status !== "vencida") continue;
      const dedupeKey = `preventiva:${p.veiculoId}:${p.motivos.join("|")}`;
      void criarNotificacao({
        tipo: "preventiva_vencida",
        role_scope: "compras",
        target_id: p.veiculoId,
        titulo: `Preventiva vencida: ${p.codigo} · ${p.nome}`,
        mensagem: p.motivos.join(" · "),
        dedupeKey,
      });
    }
  }, [preventivasAlerta]);



  // Escopos que o usuário atual deve receber notificações:
  // Financeiro recebe quando Compras cria/comenta (role_scope='financeiro').
  // Compras recebe quando Financeiro responde/comenta (role_scope='compras').
  const scopes = useMemo<RoleScope[]>(() => {
    const nivel = currentPlayer?.acessos?.financeiro;
    const isGM = currentPlayer?.isGM;
    const s: RoleScope[] = [];
    if (isGM || nivel === "financeiro") s.push("financeiro");
    if (isGM || nivel === "compras") s.push("compras");
    return s;
  }, [currentPlayer]);

  const meLogin = currentPlayer?.login || "";
  // PRO-030 — id no espaço do backend legado (`usuarios.id`), que é como
  // `solicitacoes_financeiras.criado_por` guarda o criador.
  const meuId = currentPlayer?.id ? String(currentPlayer.id) : "";
  const [notifs, setNotifs] = useState<Notificacao[]>([]);

  const loadNotifs = useCallback(async () => {
    // Sem escopo de setor E sem id não há nada a buscar. Só `scopes` vazio não
    // basta: as dirigidas chegam a quem não tem módulo financeiro.
    if (scopes.length === 0 && !meuId) {
      setNotifs([]);
      return;
    }
    const rows = await fetchNotificacoes(scopes, meuId || null);
    // O canal (`role_scope`) não diz o setor: sem este filtro, aviso de uma
    // solicitação do Depto. Pessoal caía no sino de quem só cuida de Compras.
    setNotifs(
      filtrarNotificacoesPorSetor(rows, {
        podeVerSetor: (setor) => podePlayerVerSetorFinanceiro(currentPlayer, setor),
        meusIds: meuId ? [meuId] : [],
      }),
    );
  }, [scopes, meuId, currentPlayer]);


  useEffect(() => {
    loadNotifs();
    const t = setInterval(loadNotifs, 60_000); // refresh 1min
    return () => clearInterval(t);
  }, [loadNotifs]);

  const pendentes = useMemo(
    () => notifs.filter((n) => !n.lida_por.includes(meLogin)),
    [notifs, meLogin],
  );

  // Dirigidas a mim vs. as do meu setor. A separação é o que mantém uma única
  // entrada quando sou criador E pertenço ao setor avisado — o dedupe por `id`
  // já aconteceu em `fetchNotificacoes`.
  const notifsDirigidas = useMemo(
    () => (meuId ? pendentes.filter((n) => n.destinatario_id === meuId) : []),
    [pendentes, meuId],
  );
  const notifsPendentes = useMemo(
    () => pendentes.filter((n) => n.destinatario_id !== meuId),
    [pendentes, meuId],
  );

  const marcar = async (n: Notificacao) => {
    if (!meLogin) return;
    await marcarComoLida(n.id, meLogin, n.lida_por);
    setNotifs((prev) =>
      prev.map((x) => (x.id === n.id ? { ...x, lida_por: [...x.lida_por, meLogin] } : x)),
    );
  };

  const marcarTodas = async () => {
    if (!meLogin) return;
    await Promise.all(pendentes.map((n) => marcarComoLida(n.id, meLogin, n.lida_por)));
    setNotifs((prev) =>
      prev.map((n) =>
        n.lida_por.includes(meLogin) ? n : { ...n, lida_por: [...n.lida_por, meLogin] },
      ),
    );
  };

  // Documentos vencendo — filtros existentes
  const tiposDisponiveis = useMemo(() => {
    const set = new Set<string>();
    expiring.forEach((e) => set.add(e.documento.nome || "Outros"));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [expiring]);

  const [tiposOcultos, setTiposOcultos] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return new Set(JSON.parse(raw));
    } catch (err) { swallow("NotificationBell.loadFiltro", err, "localStorage indisponível"); }
    return new Set();
  });
  const [filtroAberto, setFiltroAberto] = useState(false);

  const persist = (next: Set<string>) => {
    setTiposOcultos(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next)));
    } catch (err) { swallow("NotificationBell.persistFiltro", err, "localStorage indisponível"); }
  };
  const toggleTipo = (tipo: string) => {
    const next = new Set(tiposOcultos);
    if (next.has(tipo)) next.delete(tipo);
    else next.add(tipo);
    persist(next);
  };
  const limparFiltros = () => persist(new Set());
  const ocultarTodos = () => persist(new Set(tiposDisponiveis));

  const grupos = useMemo(() => {
    const map = new Map<string, typeof expiring>();
    expiring.forEach((e) => {
      const tipo = e.documento.nome || "Outros";
      if (tiposOcultos.has(tipo)) return;
      const arr = map.get(tipo) || [];
      arr.push(e);
      map.set(tipo, arr);
    });
    return Array.from(map.entries())
      .map(([tipo, itens]) => ({
        tipo,
        itens: itens.sort(
          (a, b) =>
            new Date(a.documento.dataVencimento).getTime() -
            new Date(b.documento.dataVencimento).getTime(),
        ),
      }))
      .sort((a, b) => a.tipo.localeCompare(b.tipo, "pt-BR"));
  }, [expiring, tiposOcultos]);

  const [prefsAbertas, setPrefsAbertas] = useState(false);
  const scopeVisivel = isVisivel("aprovacao_financeira");
  const notifsPendentesVisiveis = scopeVisivel ? notifsPendentes : [];
  // PRO-030 — categoria própria: silenciar o ruído geral de Aprovação
  // Financeira não silencia o que é sobre as minhas solicitações.
  const dirigidasVisiveis = isVisivel("comentarios_minhas_solicitacoes")
    ? notifsDirigidas
    : [];
  const totalDocs = grupos.reduce((acc, g) => acc + g.itens.length, 0);
  const totalBadge =
    totalDocs +
    notifsPendentesVisiveis.length +
    dirigidasVisiveis.length +
    contratosAlerta.length +
    contratoDocsVencendo.length +
    followupsAlerta.length +
    ncAlertas.length +
    (totvsAlerta ? 1 : 0) +
    preventivasAlerta.length +
    (snapshotVelho ? 1 : 0) +
    medicoesPendentes.length;



  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-lg hover:bg-secondary transition-colors">
          <Bell className="h-5 w-5 text-foreground" />
          {totalBadge > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {totalBadge}
            </span>
          )}
        </button>
      </PopoverTrigger>
      {/* O teto e a rolagem vivem aqui, no popover inteiro: as seções abaixo
          apenas empilham. Antes cada uma tinha o seu `ScrollArea max-h-*`, que
          não rolava (o Root só ganha `overflow-hidden`, e o viewport `h-full`
          não mede contra altura indefinida) — só cortava, escondendo item sem
          deixar alcançá-lo. */}
      <PopoverContent className="w-96 p-0 max-h-[85vh] flex flex-col" align="end">
        {/* Preferências de notificação (PRO-030) */}
        <div className="shrink-0 p-3 border-b border-border flex items-center justify-between gap-2">
          <h4 className="font-display font-semibold text-sm">Notificações</h4>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setPrefsAbertas((v) => !v)}
          >
            <Settings2 className="h-3.5 w-3.5 mr-1" />
            Preferências
            {ocultas.size > 0 && (
              <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                {ocultas.size}
              </span>
            )}
          </Button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {prefsAbertas && (
            <div className="p-3 border-b border-border bg-muted/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Categorias exibidas no sino
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={mostrarTodas}
                    className="text-[11px] text-primary hover:underline"
                  >
                    Mostrar todas
                  </button>
                  <span className="text-[11px] text-muted-foreground">·</span>
                  <button
                    onClick={ocultarTodas}
                    className="text-[11px] text-primary hover:underline"
                  >
                    Ocultar todas
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                {NOTIF_CATEGORIAS.map((cat) => (
                  <label
                    key={cat.id}
                    className="flex items-start gap-2 px-2 py-1 rounded-md hover:bg-accent cursor-pointer text-sm"
                  >
                    <Checkbox
                      className="mt-0.5"
                      checked={!ocultas.has(cat.id)}
                      onCheckedChange={() => alternar(cat.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm">{cat.rotulo}</div>
                      <div className="text-[11px] text-muted-foreground">{cat.descricao}</div>
                    </div>
                  </label>
                ))}
              </div>

              {/* PRO-019 · slice-06 — silenciados de contratos */}
              {canSeeContratos && Object.keys(silenciadosMapa).length > 0 && (
                <div className="pt-2 border-t border-border/50">
                  <div className="text-xs font-medium text-muted-foreground mb-1">
                    Alertas de contrato silenciados
                  </div>
                  <ul className="space-y-1">
                    {Object.entries(silenciadosMapa).map(([chave, ate]) => {
                      const [contratoId, tipo] = chave.split(":") as [string, "renovacao" | "reajuste"];
                      const nome =
                        contratosAlertaTodos.find((a) => a.contrato.id === contratoId)?.contrato
                          .locacaoServico ?? `#${contratoId.slice(0, 6)}`;
                      return (
                        <li
                          key={chave}
                          className="flex items-center justify-between gap-2 text-[11px] px-2 py-1 rounded-md hover:bg-accent"
                        >
                          <span className="truncate">
                            <span className="font-mono text-[10px] text-muted-foreground mr-1">{numeroContrato(contratoId)}</span>
                            <span className="font-medium">{nome}</span>
                            <span className="text-muted-foreground"> · {tipo} até {fmtDataLocal(ate)}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => reativarSilencio(contratoId, tipo)}
                            className="text-primary hover:underline shrink-0"
                          >
                            reativar
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* PRO-030 — Comentários nas solicitações que EU criei. Fora do gate de
              `scopes`: chega a quem criou a solicitação, tenha ou não módulo
              financeiro. */}
          {dirigidasVisiveis.length > 0 && (
            <div className="border-b border-border">
              <div className="p-3 flex items-center justify-between gap-2">
                <h4 className="font-display font-semibold text-sm flex items-center gap-1.5">
                  <MessageSquare className="h-4 w-4" /> Comentários nas minhas solicitações
                </h4>
                <Badge variant="secondary" className="text-[10px] h-5">
                  {dirigidasVisiveis.length}
                </Badge>
              </div>
              <div className="p-2 space-y-1">
                {dirigidasVisiveis.map((n) => (
                  <Link
                    key={n.id}
                    to="/financeiro/aprovacao"
                    onClick={() => marcar(n)}
                    className="block p-2 rounded-md hover:bg-secondary/60 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{n.titulo}</p>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {fmtDataHora(n.created_at)}
                      </span>
                    </div>
                    {n.mensagem && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{n.mensagem}</p>
                    )}
                    {n.autor_login && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        por {n.autor_login}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Notificações internas */}
          {scopes.length > 0 && scopeVisivel && (

            <div className="border-b border-border">
              <div className="p-3 flex items-center justify-between gap-2">
                <h4 className="font-display font-semibold text-sm">Aprovação Financeira</h4>
                {notifsPendentes.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={marcarTodas}
                  >
                    <CheckCheck className="h-3.5 w-3.5 mr-1" /> Marcar todas como lidas
                  </Button>
                )}
              </div>
              {notifsPendentes.length === 0 ? (
                <p className="p-4 text-xs text-muted-foreground text-center">
                  Nenhuma notificação pendente.
                </p>
              ) : (
                <div className="p-2 space-y-1">
                  {notifsPendentes.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => marcar(n)}
                      className="w-full text-left p-2 rounded-md hover:bg-secondary/60 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium">{n.titulo}</p>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {fmtDataHora(n.created_at)}
                        </span>
                      </div>
                      {n.mensagem && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{n.mensagem}</p>
                      )}
                      {n.autor_login && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          por {n.autor_login}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Contratos a vencer / renovar / reajustar (PRO-019) */}
          {canSeeContratos && contratosAlerta.length > 0 && (
            <div className="border-b border-border">
              <div className="p-3 flex items-center justify-between gap-2">
                <h4 className="font-display font-semibold text-sm flex items-center gap-1.5">
                  <FileSignature className="h-4 w-4" /> Contratos e reajustes
                </h4>
                <Badge
                  variant={
                    contratosAlerta.some((a) => a.severidade === "critica")
                      ? "destructive"
                      : "secondary"
                  }
                  className="text-[10px] h-5"
                >
                  {contratosAlerta.length}
                </Badge>
              </div>
              <div className="p-2 space-y-1">
                {contratosAlerta.slice(0, 15).map((a) => (
                  <Link
                    key={`${a.contrato.id}:${a.tipo}`}
                    to="/contratos"
                    className="block p-2 rounded-md hover:bg-secondary/60 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium truncate">
                        <span className="font-mono text-[10px] text-muted-foreground mr-1">{numeroContrato(a.contrato.id)}</span>
                        {a.contrato.locacaoServico}
                      </p>
                      <span
                        className={`text-[10px] font-semibold shrink-0 ${
                          a.situacao === "vencido"
                            ? "text-destructive"
                            : a.situacao === "hoje"
                              ? "text-warning"
                              : "text-warning"
                        }`}
                      >
                        {a.tipo === "reajuste"
                          ? a.situacao === "vencido"
                            ? `reajuste há ${Math.abs(a.diasRestantes)}d`
                            : a.diasRestantes === 0
                              ? "reajuste hoje"
                              : `reajuste em ${a.diasRestantes}d`
                          : a.situacao === "vencido"
                            ? `vencido há ${Math.abs(a.diasRestantes)}d`
                            : a.diasRestantes === 0
                              ? "vence hoje"
                              : `vence em ${a.diasRestantes}d`}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {a.contrato.tipo} · {a.tipo === "reajuste" ? "reajuste" : "término"} {fmtDataLocal(a.dataAlvo)}
                      {a.origem === "aditivo" ? " (aditivo)" : ""}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* PRO-021 · slice-04 — Documentos de contrato a vencer */}
          {canSeeContratos && contratoDocsVencendo.length > 0 && (
            <div className="border-b border-border">
              <div className="p-3 flex items-center justify-between gap-2">
                <h4 className="font-display font-semibold text-sm flex items-center gap-1.5">
                  <FileSignature className="h-4 w-4" /> Documentos de contratos
                </h4>
                <Badge
                  variant={
                    contratoDocsVencendo.some((d) => d.situacao !== "proximo")
                      ? "destructive"
                      : "secondary"
                  }
                  className="text-[10px] h-5"
                >
                  {contratoDocsVencendo.length}
                </Badge>
              </div>
              <div className="p-2 space-y-1">
                {contratoDocsVencendo.slice(0, 15).map((d) => {
                  const nome = contratosNomeMap.get(d.documento.contratoId) ?? "Contrato";
                  const numDoc = numeroContrato(d.documento.contratoId);
                  return (
                    <Link
                      key={d.documento.id}
                      to="/contratos"
                      className="block p-2 rounded-md hover:bg-secondary/60 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium truncate">{d.documento.nomeArquivo}</p>
                        <span
                          className={`text-[10px] font-semibold shrink-0 ${
                            d.situacao === "vencido"
                              ? "text-destructive"
                              : d.situacao === "hoje"
                                ? "text-warning"
                                : "text-warning"
                          }`}
                        >
                          {d.situacao === "vencido"
                            ? `vencido há ${Math.abs(d.diasRestantes)}d`
                            : d.situacao === "hoje"
                              ? "vence hoje"
                              : `vence em ${d.diasRestantes}d`}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">
                        <span className="font-mono mr-1">{numDoc}</span>{nome} · v{d.documento.versao} · válido até {fmtDataLocal(d.documento.validoAte!)}
                      </p>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}



          {/* Follow-ups CRM (PRO-030 · PRO-002) */}
          {canSeeCrm && followupsAlerta.length > 0 && (
            <div className="border-b border-border">
              <div className="p-3 flex items-center justify-between gap-2">
                <h4 className="font-display font-semibold text-sm flex items-center gap-1.5">
                  <CalendarClock className="h-4 w-4" /> Follow-ups CRM
                </h4>
                <Badge variant="secondary" className="text-[10px] h-5">
                  {followupsAlerta.length}
                </Badge>
              </div>
              <div className="p-2 space-y-1">
                {followupsAlerta.slice(0, 12).map((t) => {
                  const cls =
                    classificarTarefa(t, hojeISO) === "vencida"
                      ? "text-destructive"
                      : "text-warning";
                  return (
                    <div
                      key={t.id}
                      className="p-2 rounded-md hover:bg-secondary/60 transition-colors"
                    >
                      <Link
                        to={`/crm/oportunidades/${t.oportunidadeId}`}
                        className="block"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium truncate">{t.titulo}</p>
                          <span className={`text-[10px] font-semibold shrink-0 ${cls}`}>
                            {fmtDataLocal(t.data)}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {oportNome.get(t.oportunidadeId) ?? "—"}
                          {t.responsavelLogin ? ` · ${t.responsavelLogin}` : ""}
                        </p>
                      </Link>
                      {/* slice-03 — ações rápidas: adiar 1d/3d/7d e concluir. */}
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {[1, 3, 7].map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => adiarTarefaCrm(t.id, d)}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-muted hover:bg-muted/70 text-muted-foreground"
                            title={`Adiar ${d} dia${d > 1 ? "s" : ""}`}
                          >
                            +{d}d
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => alternarTarefaCrm(t.id)}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-success/10 text-success hover:bg-success/20"
                          title="Marcar como concluída"
                        >
                          ✓ concluir
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Não conformidades pendentes (PRO-007) */}
          {ncAlertas.length > 0 && (
            <div className="border-b border-border">
              <div className="p-3 flex items-center justify-between gap-2">
                <h4 className="font-display font-semibold text-sm flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4" /> Não conformidades
                </h4>
                <Badge variant="secondary" className="text-[10px] h-5">
                  {ncAlertas.length}
                </Badge>
              </div>
              <div className="p-2 space-y-1">
                {ncAlertas.slice(0, 12).map((n) => {
                  const cls =
                    n.situacao === "vencida"
                      ? "text-destructive"
                      : n.situacao === "hoje"
                        ? "text-warning"
                        : n.situacao === "aguardando_reinspecao"
                          ? "text-primary"
                          : "text-warning";
                  const badgeText =
                    n.situacao === "aguardando_reinspecao"
                      ? "reinspeção"
                      : n.situacao === "vencida"
                        ? `${Math.abs(n.diasRestantes ?? 0)}d atraso`
                        : n.diasRestantes === 0
                          ? "hoje"
                          : `em ${n.diasRestantes}d`;
                  return (
                    <Link
                      key={n.id}
                      to="/inspecoes/ncs"
                      className="block p-2 rounded-md hover:bg-secondary/60 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium truncate">
                          {n.codigo ? `${n.codigo} · ` : ""}
                          {n.titulo}
                        </p>
                        <span className={`text-[10px] font-semibold shrink-0 ${cls}`}>
                          {badgeText}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {n.severidade} · {n.status.replace("_", " ")}
                        {n.quando_planejado ? ` · ${fmtDataLocal(n.quando_planejado)}` : ""}
                      </p>
                    </Link>
                  );
                })}

              </div>
            </div>
          )}

          {/* Importação TOTVS atrasada (PRO-015) */}
          {totvsAlerta && (
            <div className="border-b border-border">
              <div className="p-3 flex items-center justify-between gap-2">
                <h4 className="font-display font-semibold text-sm flex items-center gap-1.5">
                  <DatabaseZap className="h-4 w-4" /> Importação TOTVS
                </h4>
                <Badge
                  variant={totvsAlerta.status === "atrasada" ? "destructive" : "secondary"}
                  className="text-[10px] h-5"
                >
                  {totvsAlerta.status === "atrasada"
                    ? `${totvsAlerta.atrasoDias}d atraso`
                    : "vence hoje"}
                </Badge>
              </div>
              <div className="p-2">
                <Link
                  to="/financeiro/importar"
                  className="block p-2 rounded-md hover:bg-secondary/60 transition-colors"
                >
                  <p className="text-sm font-medium">
                    {totvsAlerta.status === "atrasada"
                      ? `Importação atrasada há ${totvsAlerta.atrasoDias} dia(s)`
                      : "Importação prevista para hoje"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Cadência: {CADENCIA_LABEL[totvsAlerta.cadencia]}
                    {totvsAlerta.ultimaImportacao
                      ? ` · última: ${fmtDataLocal(totvsAlerta.ultimaImportacao)}`
                      : ""}
                  </p>
                </Link>
              </div>
            </div>
          )}

          {/* Snapshot TOTVS antigo (PRO-030 slice-03) */}
          {snapshotVelho && (
            <div className="border-b border-border">
              <div className="p-3 flex items-center justify-between gap-2">
                <h4 className="font-display font-semibold text-sm flex items-center gap-1.5">
                  <DatabaseZap className="h-4 w-4" /> Snapshot TOTVS
                </h4>
                <Badge
                  variant={snapshotVelho.status === "critico" ? "destructive" : "secondary"}
                  className="text-[10px] h-5"
                >
                  {snapshotVelho.ageDays}d
                </Badge>
              </div>
              <div className="p-2">
                <Link
                  to="/financeiro/importar"
                  className="block p-2 rounded-md hover:bg-secondary/60 transition-colors"
                >
                  <p className="text-sm font-medium">
                    Snapshot ativo com {snapshotVelho.ageDays} dia
                    {snapshotVelho.ageDays === 1 ? "" : "s"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Última importação: {fmtDataLocal(snapshotVelho.importadoEm)}
                    {snapshotVelho.status === "critico"
                      ? " · importe um snapshot novo"
                      : " · considere importar um snapshot mais recente"}
                  </p>
                </Link>
              </div>
            </div>
          )}

          {/* Medições aguardando aprovação (PRO-016 slice-02) */}
          {canAprovarMedicao && medicoesPendentes.length > 0 && (
            <div className="border-b border-border">
              <div className="p-3 flex items-center justify-between gap-2">
                <h4 className="font-display font-semibold text-sm flex items-center gap-1.5">
                  <ClipboardCheck className="h-4 w-4" /> Medições aguardando aprovação
                </h4>
                <Badge variant="secondary" className="text-[10px] h-5">
                  {medicoesPendentes.length}
                </Badge>
              </div>
              <div className="p-2 space-y-1">
                {medicoesPendentes.slice(0, 15).map((m) => {
                  const obraNome = obrasNomeMap.get(m.obraId) ?? "Obra";
                  const dias = m.diasEsperando;
                  const cls =
                    dias >= 7
                      ? "text-destructive"
                      : dias >= 3
                        ? "text-warning"
                        : "text-muted-foreground";
                  return (
                    <Link
                      key={m.id}
                      to={`/obras/${m.obraId}`}
                      className="block p-2 rounded-md hover:bg-secondary/60 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium truncate">
                          Medição {m.numero} · {obraNome}
                        </p>
                        <span className={`text-[10px] font-semibold shrink-0 ${cls}`}>
                          {dias === 0 ? "hoje" : `${dias}d`}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {m.enviadaPor ? `enviada por ${m.enviadaPor}` : "aguardando aprovação"}
                        {m.enviadaEm ? ` · ${fmtDataLocal(m.enviadaEm)}` : ""}
                      </p>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}




          {/* Preventiva de frota (PRO-024) */}
          {canSeeFrotas && preventivasAlerta.length > 0 && (
            <div className="border-b border-border">
              <div className="p-3 flex items-center justify-between gap-2">
                <h4 className="font-display font-semibold text-sm flex items-center gap-1.5">
                  <Wrench className="h-4 w-4" /> Preventiva de frota
                </h4>
                <Badge variant="secondary" className="text-[10px] h-5">
                  {preventivasAlerta.length}
                </Badge>
              </div>
              <div className="p-2 space-y-1">
                {preventivasAlerta.slice(0, 15).map((a) => {
                  const cls =
                    a.status === "vencida"
                      ? "text-destructive"
                      : "text-warning";
                  return (
                    <Link
                      key={a.veiculoId}
                      to="/veiculos"
                      className="block p-2 rounded-md hover:bg-secondary/60 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium truncate">
                          <span className="matricula-badge mr-1">{a.codigo}</span>
                          {a.nome}
                        </p>
                        <span className={`text-[10px] font-semibold shrink-0 ${cls}`}>
                          {a.status === "vencida" ? "vencida" : "próxima"}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {a.motivos.join(" · ")}
                      </p>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Documentos próximos a vencer */}
          <div className="p-3 border-b border-border flex items-center justify-between gap-2">
            <h4 className="font-display font-semibold text-sm">Documentos Próximos a Vencer</h4>
            {tiposDisponiveis.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs relative"
                onClick={() => setFiltroAberto((v) => !v)}
              >
                <Filter className="h-3.5 w-3.5 mr-1" />
                Filtros
                {tiposOcultos.size > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                    {tiposOcultos.size}
                  </span>
                )}
              </Button>
            )}
          </div>

          {filtroAberto && tiposDisponiveis.length > 0 && (
            <div className="p-3 border-b border-border bg-muted/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Tipos de documento</span>
                <div className="flex gap-1">
                  <button
                    onClick={limparFiltros}
                    className="text-[11px] text-primary hover:underline"
                  >
                    Mostrar todos
                  </button>
                  <span className="text-[11px] text-muted-foreground">·</span>
                  <button onClick={ocultarTodos} className="text-[11px] text-primary hover:underline">
                    Ocultar todos
                  </button>
                </div>
              </div>
              <div className="space-y-1 pr-2">
                {tiposDisponiveis.map((tipo) => (
                  <label
                    key={tipo}
                    className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-accent cursor-pointer text-sm"
                  >
                    <Checkbox
                      checked={!tiposOcultos.has(tipo)}
                      onCheckedChange={() => toggleTipo(tipo)}
                    />
                    <span className="truncate flex-1">{tipo}</span>
                    <span className="text-xs text-muted-foreground">
                      {expiring.filter((e) => (e.documento.nome || "Outros") === tipo).length}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {expiring.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground text-center">
              Nenhum documento próximo ao vencimento.
            </p>
          ) : grupos.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground text-center">
              Nenhum documento corresponde aos filtros selecionados.
            </p>
          ) : (
            <div className="p-2 space-y-2">
              {grupos.map((grupo) => (
                <Collapsible key={grupo.tipo} defaultOpen>
                  <CollapsibleTrigger className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-secondary/50 group">
                    <div className="flex items-center gap-2 min-w-0">
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=closed]:-rotate-90" />
                      <span className="text-sm font-semibold truncate">{grupo.tipo}</span>
                    </div>
                    <Badge variant="secondary" className="text-[10px] h-5">
                      {grupo.itens.length}
                    </Badge>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-1 mt-1">
                    {grupo.itens.map((item, i) => (
                      <div
                        key={`${grupo.tipo}-${i}`}
                        className="flex items-center gap-2 p-2 pl-6 rounded-md hover:bg-secondary/50 text-sm"
                      >
                        <div className="matricula-badge">
                          {item.colaborador.matricula.padStart(4, "0")}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.colaborador.nome}</p>
                          <p className="text-xs text-warning font-medium">
                            {fmtDataLocal(item.documento.dataVencimento)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
