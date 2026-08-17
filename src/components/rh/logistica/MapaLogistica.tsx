import React, { useCallback, useMemo, useRef, useState } from "react";
// Importado como `MapGL` de propósito: `Map` sombrearia o construtor nativo,
// que este arquivo usa para agrupar pontos.
import MapGL, {
  Marker,
  NavigationControl,
  ScaleControl,
  type MapRef,
} from "@vis.gl/react-maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import CamadaRotas from "./CamadaRotas";
import CirculoRaio from "./CirculoRaio";
import ClusterCidade from "./ClusterCidade";
import HoverCardColaborador from "./HoverCardColaborador";
import LegendaMapa from "./LegendaMapa";
import HoverCardObra from "./HoverCardObra";
import PinObra, { type EstadoObra } from "./PinObra";
import {
  ATTR_MARCADOR,
  ATTR_OBRA_ALVO,
  dentroDeMarcador,
  obraIdSobPonto,
} from "@/lib/logistica/drop-target";
import type { GeometriaRota } from "@/lib/logistica/osrm";
import type { DeficitFuncao } from "@/lib/logistica/equipes";
import type { PontoColaborador, PontoObra } from "@/hooks/rh/useLogisticaPontos";
import type { Coordenada } from "@/lib/logistica/haversine";
import type { Obra } from "@/types";

const ESTILOS: Record<"light" | "dark", string> = {
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
};

const VISAO_INICIAL = { longitude: -52, latitude: -14, zoom: 3.4 };
const LIMIAR_ARRASTO_PX = 4;

export interface MapaLogisticaProps {
  colaboradores: PontoColaborador[];
  obras: PontoObra[];
  obrasPorId: Map<string, Obra>;
  efetivoPorObra: Map<string, number>;
  deficitPorObra: Map<string, DeficitFuncao[]>;
  colaboradoresEsmaecidos: Set<string>;
  obraSelecionadaId: string | null;
  distanciaPorColaborador?: Map<string, number>;
  rota: GeometriaRota | null;
  rotaEstimada?: boolean;
  raioKm?: number;
  onSelecionarObra: (obraId: string | null) => void;
  onSoltarSobreObra: (colaborador: PontoColaborador, obra: PontoObra) => void;
  /**
   * Quando `true`, arrastar um pin de colaborador reposiciona sua coordenada
   * (persistida como override manual) em vez de disparar mobilização.
   */
  modoEdicaoPin?: boolean;
  onMoverColaborador?: (colaboradorId: string, coord: Coordenada) => void;
  className?: string;
}

interface ArrastoAtivo {
  ponto: PontoColaborador;
  origem: Coordenada;
  atual: Coordenada;
  iniciouMovimento: boolean;
  clientX0: number;
  clientY0: number;
}

function agruparPorCoordenada(pontos: PontoColaborador[]): Map<string, PontoColaborador[]> {
  const grupos = new Map<string, PontoColaborador[]>();
  for (const p of pontos) {
    if (!p.coord) continue;
    const chave = `${p.coord.lat.toFixed(4)},${p.coord.lng.toFixed(4)}`;
    const grupo = grupos.get(chave);
    if (grupo) grupo.push(p);
    else grupos.set(chave, [p]);
  }
  return grupos;
}

function estadoDaObra(deficits: DeficitFuncao[] | undefined): EstadoObra {
  if (!deficits || deficits.length === 0) return "completa";
  const total = deficits.reduce((soma, d) => soma + d.deficit, 0);
  return total >= 5 ? "critica" : "deficit";
}

/**
 * Mapa da logística: pins, rotas e o arrasto colaborador → obra.
 *
 * O arrasto tem dois modos:
 *  - padrão: soltar sobre uma obra dispara mobilização;
 *  - `modoEdicaoPin`: soltar em qualquer ponto reposiciona o pin (override).
 * A troca é explícita porque os gestos colidem — não dá para inferir intenção.
 */
const MapaLogistica: React.FC<MapaLogisticaProps> = ({
  colaboradores,
  obras,
  obrasPorId,
  efetivoPorObra,
  deficitPorObra,
  colaboradoresEsmaecidos,
  obraSelecionadaId,
  distanciaPorColaborador,
  rota,
  rotaEstimada,
  raioKm = 0,
  onSelecionarObra,
  onSoltarSobreObra,
  modoEdicaoPin = false,
  onMoverColaborador,
  className,
}) => {
  const { resolvedTheme } = useTheme();
  const mapRef = useRef<MapRef | null>(null);

  const [arrasto, setArrasto] = useState<ArrastoAtivo | null>(null);
  const [obraSobPonteiro, setObraSobPonteiro] = useState<string | null>(null);
  const [clusterExpandido, setClusterExpandido] = useState<string | null>(null);
  const [hoverColab, setHoverColab] = useState<PontoColaborador | null>(null);
  const [hoverObra, setHoverObra] = useState<PontoObra | null>(null);

  const grupos = useMemo(() => agruparPorCoordenada(colaboradores), [colaboradores]);

  const iniciarArrasto = useCallback((ponto: PontoColaborador, e: React.PointerEvent) => {
    if (!ponto.coord || e.button !== 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setArrasto({
      ponto,
      origem: ponto.coord,
      atual: ponto.coord,
      iniciouMovimento: false,
      clientX0: e.clientX,
      clientY0: e.clientY,
    });
  }, []);

  const moverArrasto = useCallback(
    (e: React.PointerEvent) => {
      if (!arrasto) return;
      const mapa = mapRef.current?.getMap();
      if (!mapa) return;

      const dx = e.clientX - arrasto.clientX0;
      const dy = e.clientY - arrasto.clientY0;
      const passouLimiar = arrasto.iniciouMovimento || Math.hypot(dx, dy) > LIMIAR_ARRASTO_PX;
      if (!passouLimiar) return;

      const caixa = mapa.getContainer().getBoundingClientRect();
      const ponto = mapa.unproject([e.clientX - caixa.left, e.clientY - caixa.top]);
      setArrasto((a) =>
        a ? { ...a, atual: { lat: ponto.lat, lng: ponto.lng }, iniciouMovimento: true } : a,
      );
      // Hit-test a cada movimento: é o que faz o pin da obra realçar ao passar
      // por cima. `pointerenter` não serve aqui — ver drop-target.ts.
      setObraSobPonteiro(obraIdSobPonto(e.clientX, e.clientY));
    },
    [arrasto],
  );

  const encerrarArrasto = useCallback(
    (e: React.PointerEvent) => {
      if (!arrasto) return;
      if (arrasto.iniciouMovimento) {
        if (modoEdicaoPin && onMoverColaborador) {
          onMoverColaborador(arrasto.ponto.colaborador.id, arrasto.atual);
        } else {
          // Hit-test geométrico: resolve pela posição de soltura, não pelo estado acumulado.
          // Um pointerup fora de qualquer pin tem que cancelar mesmo que o último
          // movimento tenha passado sobre uma obra.
          const alvoId = obraIdSobPonto(e.clientX, e.clientY);
          const alvo = alvoId ? obras.find((o) => o.obra.id === alvoId) : null;
          if (alvo) onSoltarSobreObra(arrasto.ponto, alvo);
        }
      }
      setArrasto(null);
      setObraSobPonteiro(null);
    },
    [arrasto, obras, onSoltarSobreObra, modoEdicaoPin, onMoverColaborador],
  );

  const guia: GeometriaRota | null = arrasto?.iniciouMovimento
    ? {
        type: "LineString",
        coordinates: [
          [arrasto.origem.lng, arrasto.origem.lat],
          [arrasto.atual.lng, arrasto.atual.lat],
        ],
      }
    : null;

  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden rounded-lg border",
        modoEdicaoPin && "ring-2 ring-amber-500 ring-offset-0",
        className,
      )}
      onPointerMove={moverArrasto}
      onPointerUp={encerrarArrasto}
      onPointerCancel={encerrarArrasto}
    >
      <MapGL
        ref={mapRef}
        initialViewState={VISAO_INICIAL}
        mapStyle={ESTILOS[resolvedTheme]}
        dragPan={!arrasto}
        dragRotate={false}
        touchZoomRotate={false}
        attributionControl={{ compact: true }}
        style={{ width: "100%", height: "100%" }}
        onClick={(e) => {
          // Clique num pin também chega aqui — os `Marker` moram dentro do
          // `canvasContainer` que o MapLibre escuta, e ele dispara antes do
          // React. Sem este filtro, abrir um grupo ou selecionar uma obra
          // competia com a limpeza de estado logo abaixo.
          if (dentroDeMarcador(e.originalEvent?.target)) return;
          setClusterExpandido(null);
          onSelecionarObra(null);
        }}
      >
        <NavigationControl position="top-right" showCompass={false} />
        <ScaleControl position="bottom-left" unit="metric" />

        <CamadaRotas rota={rota} estimada={rotaEstimada} guia={guia} />
        <CirculoRaio
          centro={
            obraSelecionadaId
              ? (obras.find((o) => o.obra.id === obraSelecionadaId)?.coord ?? null)
              : null
          }
          raioKm={raioKm}
        />

        {obras.map((p) => {
          if (!p.coord) return null;
          const deficits = deficitPorObra.get(p.obra.id);
          const selecionada = obraSelecionadaId === p.obra.id;
          return (
            <Marker key={p.obra.id} longitude={p.coord.lng} latitude={p.coord.lat} anchor="center">
              <button
                type="button"
                // Marca o alvo para o hit-test do arrasto (drop-target.ts).
                {...{ [ATTR_OBRA_ALVO]: p.obra.id, [ATTR_MARCADOR]: "" }}
                className="cursor-pointer"
                onClick={() => onSelecionarObra(selecionada ? null : p.obra.id)}
                onPointerEnter={() => setHoverObra(p)}
                onPointerLeave={() => setHoverObra(null)}
                aria-label={`Obra ${p.obra.nome}`}
              >
                <PinObra
                  estado={estadoDaObra(deficits)}
                  destacado={selecionada}
                  alvoAtivo={!modoEdicaoPin && obraSobPonteiro === p.obra.id}
                />
              </button>
            </Marker>
          );
        })}

        {[...grupos.entries()].map(([chave, pontos]) => {
          const coord = pontos[0].coord!;
          return (
            <Marker
              key={chave}
              longitude={coord.lng}
              latitude={coord.lat}
              anchor="bottom"
              // Cada marcador cria o próprio contexto de empilhamento (o
              // MapLibre posiciona por `transform`), então um z-index interno
              // não vence os pins vizinhos: quem sobe é o marcador inteiro.
              style={clusterExpandido === chave ? { zIndex: 20 } : undefined}
            >
              <ClusterCidade
                pontos={pontos}
                expandido={clusterExpandido === chave}
                esmaecidos={colaboradoresEsmaecidos}
                arrastandoId={arrasto?.ponto.colaborador.id ?? null}
                onToggleExpandir={() =>
                  setClusterExpandido((atual) => (atual === chave ? null : chave))
                }
                onHover={setHoverColab}
                onIniciarArrasto={iniciarArrasto}
              />
            </Marker>
          );
        })}
      </MapGL>

      <LegendaMapa />

      {hoverColab && !arrasto && (
        <div className="pointer-events-none absolute bottom-4 left-4 z-10">
          <HoverCardColaborador
            ponto={hoverColab}
            obraAtual={
              hoverColab.colaborador.obraAtualId
                ? (obrasPorId.get(hoverColab.colaborador.obraAtualId) ?? null)
                : null
            }
            distanciaKm={distanciaPorColaborador?.get(hoverColab.colaborador.id) ?? null}
          />
        </div>
      )}

      {hoverObra && !hoverColab && (
        <div className="pointer-events-none absolute bottom-4 left-4 z-10">
          <HoverCardObra
            ponto={hoverObra}
            efetivo={efetivoPorObra.get(hoverObra.obra.id) ?? 0}
            deficits={deficitPorObra.get(hoverObra.obra.id) ?? []}
          />
        </div>
      )}

      {arrasto?.iniciouMovimento && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full bg-foreground/90 px-3 py-1 text-xs text-background shadow">
          {modoEdicaoPin
            ? `Solte para reposicionar ${arrasto.ponto.colaborador.nome}`
            : `Solte sobre uma obra para mobilizar ${arrasto.ponto.colaborador.nome}`}
        </div>
      )}

      {modoEdicaoPin && !arrasto && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-white shadow">
          Modo ajuste de pin — arraste um colaborador para reposicionar
        </div>
      )}
    </div>
  );
};

export default MapaLogistica;
