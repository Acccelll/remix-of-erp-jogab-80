import React, { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { usePermissions } from "@/contexts/auth/usePermissions";
import { useColaboradoresContext } from "@/contexts/ColaboradoresContext";
import { QueryState } from "@/components/common/QueryState";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { PanelRightOpen } from "lucide-react";
import MapaLogistica from "@/components/rh/logistica/MapaLogistica";
import PainelOtimizacao, {
  type ObraProxima,
} from "@/components/rh/logistica/PainelOtimizacao";
import DialogMobilizacao from "@/components/rh/logistica/DialogMobilizacao";
import DialogMobilizacaoLote from "@/components/rh/logistica/DialogMobilizacaoLote";
import {
  useLogisticaPontos,
  type PontoColaborador,
  type PontoObra,
} from "@/hooks/rh/useLogisticaPontos";
import { useRotaOsrm } from "@/hooks/rh/useRotaOsrm";
import { useFuncoes } from "@/hooks/rh/useFuncoes";
import { useHistogramaSemana } from "@/hooks/obras/useHistograma";
import { celulaKey, montarPreview, segundaDaSemana } from "@/lib/obras/histograma";
import { calcularDeficit, ranquearCandidatos, type DeficitFuncao } from "@/lib/logistica/equipes";
import { distanciaKm, type Coordenada } from "@/lib/logistica/haversine";
import {
  setColaboradorOverride,
  limparOverrides,
  useOverridesLogistica,
} from "@/lib/logistica/overrides";
import { norm } from "@/lib/utils";
import { hojeBrasilia } from "@/lib/core/date";
import { logger } from "@/lib/core/logger";
import { useUrlState } from "@/hooks/useUrlState";
import {
  exportarCsvInverso,
  exportarCsvPorObra,
  exportarPdfInverso,
  exportarPdfPorObra,
} from "@/lib/logistica/export";
import { useIsMobile } from "@/hooks/use-mobile";

const LIMITE_CANDIDATOS = 15;
/** Quantas obras a visão inversa lista por vez. */
const LIMITE_OBRAS_INVERSO = 10;

/**
 * Logística de Colaboradores — mapa de alocação georreferenciada.
 *
 * Onda 2 acrescentou: mobilização em lote (checkboxes + diálogo único),
 * visão inversa (colaborador focado → obras mais próximas com déficit
 * compatível), ajuste manual de pin (drag no mapa persistindo em
 * localStorage) e layout mobile com painel em bottom sheet.
 */
const LogisticaColaboradores: React.FC = () => {
  const { hasAccess } = usePermissions();
  const podeEditar = hasAccess("rh", "editar");
  const isMobile = useIsMobile();
  const { colaboradores: todosColaboradores, mobilizarColaborador } = useColaboradoresContext();
  const { data: funcoesCadastro = [] } = useFuncoes();
  const overrides = useOverridesLogistica();
  const totalOverrides =
    Object.keys(overrides.colaboradores).length + Object.keys(overrides.obras).length;

  const pontos = useLogisticaPontos();
  const semanaAtual = useMemo(() => segundaDaSemana(new Date()), []);
  const histogramaQuery = useHistogramaSemana(semanaAtual);

  // Estado sincronizado com a URL
  const [obraSelecionadaId, setObraSelecionadaIdRaw] = useUrlState("obra", "");
  const [colaboradorFocadoId, setColaboradorFocadoIdRaw] = useUrlState("colab", "");
  const [funcaoFiltro, setFuncaoFiltro] = useUrlState("funcao", "");
  const [busca, setBusca] = useUrlState("q", "");
  const [ordemInverso, setOrdemInverso] = useUrlState("ord", "distancia") as [
    "distancia" | "deficit" | "data",
    (v: string) => void,
  ];
  const [apenasDisponiveisStr, setApenasDisponiveisStr] = useUrlState("disp", "1");
  const [raioKmStr, setRaioKmStr] = useUrlState("raio", "0");
  const apenasDisponiveis = apenasDisponiveisStr !== "0";
  const raioKm = Math.max(0, Number(raioKmStr) || 0);
  const setObraSelecionadaId = useCallback(
    (id: string | null) => setObraSelecionadaIdRaw(id ?? ""),
    [setObraSelecionadaIdRaw],
  );
  const setColaboradorFocadoId = useCallback(
    (id: string) => setColaboradorFocadoIdRaw(id ?? ""),
    [setColaboradorFocadoIdRaw],
  );

  const [mobilizando, setMobilizando] = useState<{
    colaborador: PontoColaborador;
    obra: PontoObra;
  } | null>(null);
  const [dataMobilizacao, setDataMobilizacao] = useState(hojeBrasilia());
  const [salvando, setSalvando] = useState(false);
  const [erroMobilizacao, setErroMobilizacao] = useState("");

  // Onda 2 — seleção e lote
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [loteAberto, setLoteAberto] = useState(false);
  const [loteData, setLoteData] = useState(hojeBrasilia());
  const [loteProgresso, setLoteProgresso] = useState<{ feitos: number; total: number } | null>(
    null,
  );
  const [loteErro, setLoteErro] = useState("");
  const [loteSalvando, setLoteSalvando] = useState(false);

  // Onda 2 — edição de pin
  const [modoEdicaoPin, setModoEdicaoPin] = useState(false);

  // Onda 2 — sheet mobile
  const [sheetAberto, setSheetAberto] = useState(false);

  const obrasPorId = useMemo(
    () => new Map(pontos.obras.map((p) => [p.obra.id, p.obra])),
    [pontos.obras],
  );

  const obraSelecionada = useMemo(
    () => (obraSelecionadaId ? (pontos.obras.find((p) => p.obra.id === obraSelecionadaId) ?? null) : null),
    [pontos.obras, obraSelecionadaId],
  );

  const colaboradorFocado = useMemo(
    () =>
      colaboradorFocadoId
        ? (pontos.colaboradores.find((p) => p.colaborador.id === colaboradorFocadoId) ?? null)
        : null,
    [pontos.colaboradores, colaboradorFocadoId],
  );

  const nomesFuncoes = useMemo(
    () =>
      funcoesCadastro
        .filter((f) => f.ativa)
        .map((f) => f.nome)
        .sort((a, b) => a.localeCompare(b, "pt-BR")),
    [funcoesCadastro],
  );

  const efetivoPorCelula = useMemo(
    () =>
      montarPreview({
        colaboradores: todosColaboradores,
        veiculos: [],
        contratos: [],
        obraIds: pontos.obras.map((p) => p.obra.id),
      }),
    [todosColaboradores, pontos.obras],
  );

  const previstoPorCelula = histogramaQuery.data;

  const deficitPorObra = useMemo(() => {
    const mapa = new Map<string, DeficitFuncao[]>();
    if (!previstoPorCelula) return mapa;
    for (const p of pontos.obras) {
      const deficits = calcularDeficit(
        p.obra.id,
        nomesFuncoes,
        previstoPorCelula,
        efetivoPorCelula,
      );
      if (deficits.length > 0) mapa.set(p.obra.id, deficits);
    }
    return mapa;
  }, [pontos.obras, nomesFuncoes, previstoPorCelula, efetivoPorCelula]);

  const efetivoPorObra = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const p of pontos.obras) {
      let total = 0;
      for (const funcao of [...nomesFuncoes, "Sem função"]) {
        total += efetivoPorCelula.get(celulaKey(p.obra.id, "funcao", funcao)) ?? 0;
      }
      mapa.set(p.obra.id, total);
    }
    return mapa;
  }, [pontos.obras, nomesFuncoes, efetivoPorCelula]);

  const ufsDisponiveis = useMemo(() => {
    const set = new Set<string>();
    for (const p of pontos.colaboradores) {
      const uf = p.colaborador.uf?.toUpperCase();
      if (uf) set.add(uf);
    }
    return [...set].sort();
  }, [pontos.colaboradores]);

  const nrsDisponiveis = useMemo(() => {
    const set = new Set<string>();
    for (const f of funcoesCadastro) for (const n of f.nrs ?? []) if (n) set.add(n);
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [funcoesCadastro]);

  const hojeISO = useMemo(() => hojeBrasilia(), []);

  const colaboradoresEsmaecidos = useMemo(() => {
    const escondidos = new Set<string>();
    if (colaboradorFocado) return escondidos;
    const buscaNorm = norm(busca);
    const centro = obraSelecionada?.coord ?? null;
    for (const p of pontos.colaboradores) {
      const c = p.colaborador;
      const casaFuncao = !funcaoFiltro || c.funcao === funcaoFiltro;
      const casaBusca = !buscaNorm || norm(c.nome).includes(buscaNorm);
      const casaDisponivel =
        !apenasDisponiveis || (!c.obraAtualId && !c.mobilizacaoPendente) || !!c.statusEspecial;
      const casaRaio =
        raioKm <= 0 || !centro || (p.coord ? distanciaKm(p.coord, centro) <= raioKm : false);
      if (!casaFuncao || !casaBusca || !casaDisponivel || !casaRaio) escondidos.add(c.id);
    }
    return escondidos;
  }, [
    pontos.colaboradores,
    funcaoFiltro,
    busca,
    apenasDisponiveis,
    raioKm,
    obraSelecionada,
    colaboradorFocado,
  ]);

  const distanciaPorColaborador = useMemo(() => {
    const mapa = new Map<string, number>();
    if (!obraSelecionada?.coord) return mapa;
    for (const p of pontos.colaboradores) {
      if (p.coord) mapa.set(p.colaborador.id, distanciaKm(p.coord, obraSelecionada.coord));
    }
    return mapa;
  }, [pontos.colaboradores, obraSelecionada]);

  const candidatos = useMemo(() => {
    if (!obraSelecionada) return [];
    return ranquearCandidatos({
      destino: obraSelecionada.coord,
      candidatos: pontos.colaboradores
        .filter((p) => !colaboradoresEsmaecidos.has(p.colaborador.id))
        .map((p) => ({ colaborador: p.colaborador, coord: p.coord })),
      deficits: deficitPorObra.get(obraSelecionada.obra.id) ?? [],
      limite: LIMITE_CANDIDATOS,
    });
  }, [obraSelecionada, pontos.colaboradores, colaboradoresEsmaecidos, deficitPorObra]);

  /**
   * Visão inversa: dado o colaborador focado, obras mais próximas com déficit
   * na função dele primeiro, depois outras obras — sempre por distância.
   */
  const obrasProximas: ObraProxima[] = useMemo(() => {
    if (!colaboradorFocado) return [];
    const origem = colaboradorFocado.coord;
    const funcao = colaboradorFocado.colaborador.funcao || "Sem função";
    const lista: ObraProxima[] = pontos.obras.map((p) => {
      const deficits = deficitPorObra.get(p.obra.id) ?? [];
      const deficitTotal = deficits.reduce((s, d) => s + d.deficit, 0);
      const deficitFuncao = deficits.find((d) => d.funcao === funcao)?.deficit ?? 0;
      const dist = origem && p.coord ? distanciaKm(origem, p.coord) : null;
      return { ponto: p, distanciaKm: dist, deficitTotal, deficitFuncao };
    });
    lista.sort((a, b) => {
      if (ordemInverso === "deficit") {
        if (a.deficitFuncao !== b.deficitFuncao) return b.deficitFuncao - a.deficitFuncao;
        if (a.deficitTotal !== b.deficitTotal) return b.deficitTotal - a.deficitTotal;
      } else if (ordemInverso === "data") {
        const da = (a.ponto.obra as any).dataInicio ?? "9999-12-31";
        const db = (b.ponto.obra as any).dataInicio ?? "9999-12-31";
        if (da !== db) return da.localeCompare(db);
      } else {
        // "distancia": mantém prioridade original (função + distância)
        if (a.deficitFuncao > 0 !== b.deficitFuncao > 0) return a.deficitFuncao > 0 ? -1 : 1;
      }
      if ((a.distanciaKm === null) !== (b.distanciaKm === null))
        return a.distanciaKm === null ? 1 : -1;
      if (a.distanciaKm !== null && b.distanciaKm !== null)
        return a.distanciaKm - b.distanciaKm;
      return a.ponto.obra.nome.localeCompare(b.ponto.obra.nome, "pt-BR");
    });
    return lista.slice(0, LIMITE_OBRAS_INVERSO);
  }, [colaboradorFocado, pontos.obras, deficitPorObra]);

  const colaboradoresParaFoco = useMemo(
    () =>
      pontos.colaboradores
        .slice()
        .sort((a, b) => a.colaborador.nome.localeCompare(b.colaborador.nome, "pt-BR")),
    [pontos.colaboradores],
  );

  const rotaQuery = useRotaOsrm(
    mobilizando?.colaborador.coord ?? null,
    mobilizando?.obra.coord ?? null,
  );

  const exportarCsv = useCallback(() => {
    if (colaboradorFocado) {
      exportarCsvInverso({ colaborador: colaboradorFocado, obras: obrasProximas });
    } else if (obraSelecionada) {
      exportarCsvPorObra({
        obra: obraSelecionada,
        deficits: deficitPorObra.get(obraSelecionada.obra.id) ?? [],
        candidatos,
        raioKm,
      });
    }
  }, [colaboradorFocado, obrasProximas, obraSelecionada, deficitPorObra, candidatos, raioKm]);

  const exportarPdf = useCallback(() => {
    if (colaboradorFocado) {
      exportarPdfInverso({ colaborador: colaboradorFocado, obras: obrasProximas });
    } else if (obraSelecionada) {
      exportarPdfPorObra({
        obra: obraSelecionada,
        deficits: deficitPorObra.get(obraSelecionada.obra.id) ?? [],
        candidatos,
        raioKm,
      });
    }
  }, [colaboradorFocado, obrasProximas, obraSelecionada, deficitPorObra, candidatos, raioKm]);

  const abrirMobilizacao = useCallback(
    (colaborador: PontoColaborador, obra: PontoObra) => {
      if (!podeEditar) {
        toast.error("Você não tem permissão para mobilizar colaboradores.");
        return;
      }
      // Soltar sobre a própria obra atual é ruído — nada a fazer.
      if (colaborador.colaborador.obraAtualId === obra.obra.id) return;
      setErroMobilizacao("");
      setDataMobilizacao(hojeBrasilia());
      setMobilizando({ colaborador, obra });
    },
    [podeEditar],
  );

  const mobilizarPeloPainel = useCallback(
    (colaboradorId: string) => {
      const colaborador = pontos.colaboradores.find((p) => p.colaborador.id === colaboradorId);
      if (colaborador && obraSelecionada) abrirMobilizacao(colaborador, obraSelecionada);
    },
    [pontos.colaboradores, obraSelecionada, abrirMobilizacao],
  );

  const mobilizarFocadoParaObra = useCallback(
    (obraId: string) => {
      const obra = pontos.obras.find((p) => p.obra.id === obraId);
      if (obra && colaboradorFocado) abrirMobilizacao(colaboradorFocado, obra);
    },
    [pontos.obras, colaboradorFocado, abrirMobilizacao],
  );

  const confirmarMobilizacao = useCallback(async () => {
    if (!mobilizando || !dataMobilizacao) return;
    const [ano, mes, dia] = dataMobilizacao.split("-").map(Number);
    if (!ano || !mes || !dia) {
      setErroMobilizacao("Data inválida.");
      return;
    }

    setSalvando(true);
    setErroMobilizacao("");
    try {
      await mobilizarColaborador(
        mobilizando.colaborador.colaborador.id,
        mobilizando.obra.obra.id,
        dia,
        mes,
        ano,
        true,
      );
      setMobilizando(null);
    } catch (err) {
      logger.error("logistica: falha ao mobilizar", { err });
      setErroMobilizacao("Falha ao mobilizar o colaborador. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }, [mobilizando, dataMobilizacao, mobilizarColaborador]);

  // Seleção em lote
  const toggleSelecionado = useCallback((id: string) => {
    setSelecionados((s) => {
      const novo = new Set(s);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }, []);
  const limparSelecao = useCallback(() => setSelecionados(new Set()), []);

  const abrirLote = useCallback(() => {
    if (!obraSelecionada || selecionados.size === 0) return;
    setLoteData(hojeBrasilia());
    setLoteErro("");
    setLoteProgresso(null);
    setLoteAberto(true);
  }, [obraSelecionada, selecionados.size]);

  const colaboradoresLote = useMemo(
    () =>
      pontos.colaboradores.filter((p) => selecionados.has(p.colaborador.id)),
    [pontos.colaboradores, selecionados],
  );

  const confirmarLote = useCallback(async () => {
    if (!obraSelecionada || colaboradoresLote.length === 0) return;
    const [ano, mes, dia] = loteData.split("-").map(Number);
    if (!ano || !mes || !dia) {
      setLoteErro("Data inválida.");
      return;
    }
    setLoteSalvando(true);
    setLoteErro("");
    setLoteProgresso({ feitos: 0, total: colaboradoresLote.length });
    let feitos = 0;
    try {
      // Sequencial de propósito: mobilização faz atualizações de estado que
      // não são seguras em paralelo (histórico, veículos, mobilização
      // pendente). O usuário vê o contador subir em tempo real.
      for (const c of colaboradoresLote) {
        await mobilizarColaborador(
          c.colaborador.id,
          obraSelecionada.obra.id,
          dia,
          mes,
          ano,
          true,
        );
        feitos += 1;
        setLoteProgresso({ feitos, total: colaboradoresLote.length });
      }
      setLoteAberto(false);
      setSelecionados(new Set());
    } catch (err) {
      logger.error("logistica: falha em mobilização em lote", { err, feitos });
      setLoteErro(
        `Falha após ${feitos} de ${colaboradoresLote.length}. Os já mobilizados foram salvos; tente novamente para os restantes.`,
      );
    } finally {
      setLoteSalvando(false);
    }
  }, [obraSelecionada, colaboradoresLote, loteData, mobilizarColaborador]);

  const moverColaborador = useCallback((id: string, coord: Coordenada) => {
    setColaboradorOverride(id, coord);
  }, []);

  const painel = (
    <PainelOtimizacao
      obras={pontos.obras}
      obraSelecionada={obraSelecionada}
      onSelecionarObra={setObraSelecionadaId}
      deficits={obraSelecionada ? (deficitPorObra.get(obraSelecionada.obra.id) ?? []) : []}
      candidatos={candidatos}
      funcoes={nomesFuncoes}
      funcaoFiltro={funcaoFiltro}
      onFuncaoFiltro={setFuncaoFiltro}
      busca={busca}
      onBusca={setBusca}
      apenasDisponiveis={apenasDisponiveis}
      onApenasDisponiveis={(v) => setApenasDisponiveisStr(v ? "1" : "0")}
      ordemInverso={ordemInverso}
      onOrdemInverso={(v) => setOrdemInverso(v)}
      onExportarCsv={exportarCsv}
      onExportarPdf={exportarPdf}
      podeExportar={!!colaboradorFocado || !!obraSelecionada}
      raioKm={raioKm}
      onRaioKm={(v) => setRaioKmStr(String(v))}
      semLocal={pontos.colaboradoresSemLocal}
      podeEditar={podeEditar}
      onMobilizar={mobilizarPeloPainel}
      selecionados={selecionados}
      onToggleSelecionado={toggleSelecionado}
      onLimparSelecao={limparSelecao}
      onMobilizarLote={abrirLote}
      colaboradoresParaFoco={colaboradoresParaFoco}
      colaboradorFocadoId={colaboradorFocadoId}
      onColaboradorFocado={setColaboradorFocadoId}
      colaboradorFocado={colaboradorFocado}
      obrasProximas={obrasProximas}
      onMobilizarParaObra={mobilizarFocadoParaObra}
      modoEdicaoPin={modoEdicaoPin}
      onToggleEdicaoPin={() => setModoEdicaoPin((v) => !v)}
      totalOverrides={totalOverrides}
      onLimparOverrides={limparOverrides}
    />
  );

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-3 p-4">
      <div>
        <h1 className="font-display text-2xl font-bold">Logística de Colaboradores</h1>
        <p className="text-sm text-muted-foreground">
          Arraste um colaborador até uma obra para mobilizar. Colaboradores já mobilizados podem
          ser arrastados para outra obra — o sistema confirma como transferência. Quem divide a
          mesma cidade aparece em leque em volta do ponto, e grupos maiores abrem no clique. O
          painel mostra onde falta gente e quem está mais perto.
        </p>
      </div>

      <QueryState
        isLoading={pontos.isLoading}
        isError={pontos.isError}
        error={pontos.error}
        data={pontos}
        onRetry={pontos.refetch}
        loading={
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed">
            <p className="text-sm text-muted-foreground">Carregando mapa…</p>
          </div>
        }
      >
        {() => (
          <div
            className={
              isMobile
                ? "relative min-h-0 flex-1"
                : "grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[1fr_20rem]"
            }
          >
            <MapaLogistica
              colaboradores={pontos.colaboradores}
              obras={pontos.obras}
              obrasPorId={obrasPorId}
              efetivoPorObra={efetivoPorObra}
              deficitPorObra={deficitPorObra}
              colaboradoresEsmaecidos={colaboradoresEsmaecidos}
              obraSelecionadaId={obraSelecionadaId || null}
              distanciaPorColaborador={distanciaPorColaborador}
              rota={rotaQuery.data?.geometry ?? null}
              rotaEstimada={rotaQuery.data?.estimada}
              raioKm={raioKm}
              onSelecionarObra={setObraSelecionadaId}
              onSoltarSobreObra={abrirMobilizacao}
              modoEdicaoPin={modoEdicaoPin && podeEditar}
              onMoverColaborador={moverColaborador}
            />

            {isMobile ? (
              <>
                <Sheet open={sheetAberto} onOpenChange={setSheetAberto}>
                  <SheetTrigger asChild>
                    <Button
                      size="sm"
                      className="absolute bottom-4 right-4 z-10 shadow-lg"
                      aria-label="Abrir painel de otimização"
                    >
                      <PanelRightOpen className="mr-1 h-4 w-4" />
                      Painel
                      {selecionados.size > 0 && (
                        <span className="ml-1.5 rounded-full bg-background/20 px-1.5 py-0.5 text-[10px] tabular-nums">
                          {selecionados.size}
                        </span>
                      )}
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="h-[85vh] p-4">
                    {painel}
                  </SheetContent>
                </Sheet>
              </>
            ) : (
              <aside className="min-h-0 overflow-hidden">{painel}</aside>
            )}
          </div>
        )}
      </QueryState>

      <DialogMobilizacao
        open={!!mobilizando}
        colaborador={mobilizando?.colaborador ?? null}
        obra={mobilizando?.obra ?? null}
        obraOrigem={
          mobilizando?.colaborador.colaborador.obraAtualId
            ? (obrasPorId.get(mobilizando.colaborador.colaborador.obraAtualId) ?? null)
            : null
        }
        rota={rotaQuery.data ?? null}
        rotaCarregando={rotaQuery.isLoading}
        data={dataMobilizacao}
        onDataChange={setDataMobilizacao}
        loading={salvando}
        error={erroMobilizacao}
        onClose={() => setMobilizando(null)}
        onConfirm={confirmarMobilizacao}
      />

      <DialogMobilizacaoLote
        open={loteAberto}
        colaboradores={colaboradoresLote}
        obra={obraSelecionada}
        data={loteData}
        onDataChange={setLoteData}
        loading={loteSalvando}
        progresso={loteProgresso}
        error={loteErro}
        onClose={() => setLoteAberto(false)}
        onConfirm={confirmarLote}
      />
    </div>
  );
};

export default LogisticaColaboradores;
