import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import PinColaborador from "./PinColaborador";
import { estadoDoPin, PESO_ESTADO_PIN } from "@/lib/logistica/pins";
import { LIMITE_LEQUE_AUTO, posicoesLeque } from "@/lib/logistica/leque";
import { ATTR_MARCADOR } from "@/lib/logistica/drop-target";
import type { PontoColaborador } from "@/hooks/rh/useLogisticaPontos";

export interface ClusterCidadeProps {
  pontos: PontoColaborador[];
  expandido: boolean;
  esmaecidos: Set<string>;
  arrastandoId: string | null;
  onToggleExpandir: () => void;
  onHover: (ponto: PontoColaborador | null) => void;
  onIniciarArrasto: (ponto: PontoColaborador, e: React.PointerEvent) => void;
}

/**
 * Agrupamento de colaboradores que caem no mesmo ponto.
 *
 * A geocodificação é em nível de cidade, então todo mundo de Camaçari ocupa
 * exatamente a mesma coordenada. Empilhados, os pins se cobrem: só o de cima
 * era alcançável e o pin do grupo não tinha arrasto nenhum — quem morava numa
 * cidade acompanhado simplesmente não podia ser mobilizado pelo mapa.
 *
 * A saída é abrir os pins em leque (`leque.ts`), cada um com o seu próprio
 * `onPointerDown`. Grupos pequenos já nascem abertos porque o gesto de arrastar
 * é a ação principal da tela e não deve custar um clique extra; grupos grandes
 * começam recolhidos atrás de um contador para não virar poluição visual.
 */
const ClusterCidade: React.FC<ClusterCidadeProps> = ({
  pontos,
  expandido,
  esmaecidos,
  arrastandoId,
  onToggleExpandir,
  onHover,
  onIniciarArrasto,
}) => {
  // Ordem estável por nome: sem isto, mudar um filtro reembaralha o leque e o
  // pin que o usuário estava mirando escapa de baixo do cursor.
  const ordenados = useMemo(
    () =>
      pontos.slice().sort((a, b) => a.colaborador.nome.localeCompare(b.colaborador.nome, "pt-BR")),
    [pontos],
  );

  const visiveis = ordenados.filter((p) => !esmaecidos.has(p.colaborador.id));
  const todosEsmaecidos = visiveis.length === 0;

  // O pin representante mostra o estado mais "acionável" do grupo.
  const representante = (visiveis.length > 0 ? visiveis : ordenados)
    .slice()
    .sort(
      (a, b) =>
        PESO_ESTADO_PIN[estadoDoPin(a.colaborador)] - PESO_ESTADO_PIN[estadoDoPin(b.colaborador)],
    )[0];

  const aberto = ordenados.length <= LIMITE_LEQUE_AUTO || expandido;
  const posicoes = useMemo(
    () => posicoesLeque(aberto ? ordenados.length : 1),
    [aberto, ordenados.length],
  );

  // Meia-largura da caixa do SVG das linhas-guia. Um SVG com width/height zero
  // simplesmente não é desenhado (a spec desabilita o rendering), então ele
  // precisa de uma caixa real em volta da âncora — daí o viewBox centrado.
  const meiaCaixa = Math.ceil(Math.max(1, ...posicoes.map((p) => Math.hypot(p.dx, p.dy)))) + 4;

  // O contêiner é 0×0 de propósito: com `anchor="bottom"` o MapLibre alinha o
  // bottom-center do filho à coordenada, então (0,0) daqui *é* a coordenada e
  // os deslocamentos do leque valem como estão.
  return (
    <div className="relative h-0 w-0">
      {aberto && ordenados.length > 1 && (
        <>
          {/* Linhas até o ponto real: sem elas o leque mente sobre onde a
              cidade fica. O viewBox centrado deixa (0,0) coincidir com a
              âncora, então os deslocamentos do leque entram como estão. */}
          <svg
            className="pointer-events-none absolute text-foreground/30"
            style={{ left: -meiaCaixa, top: -meiaCaixa }}
            width={meiaCaixa * 2}
            height={meiaCaixa * 2}
            viewBox={`${-meiaCaixa} ${-meiaCaixa} ${meiaCaixa * 2} ${meiaCaixa * 2}`}
            aria-hidden="true"
          >
            {posicoes.map((pos, i) => (
              <line
                key={ordenados[i].colaborador.id}
                x1={0}
                y1={0}
                x2={pos.dx}
                y2={pos.dy}
                stroke="currentColor"
                strokeWidth={1}
              />
            ))}
          </svg>

          {ordenados.length > LIMITE_LEQUE_AUTO ? (
            <button
              type="button"
              {...{ [ATTR_MARCADOR]: "" }}
              className={cn(
                "absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full",
                "cursor-pointer touch-none bg-foreground ring-2 ring-background",
              )}
              onClick={onToggleExpandir}
              aria-expanded
              aria-label={`Recolher ${ordenados.length} colaboradores em ${representante.rotuloLocal ?? "mesma localidade"}`}
            />
          ) : (
            <span
              className="pointer-events-none absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/60 ring-2 ring-background"
              aria-hidden="true"
            />
          )}
        </>
      )}

      {aberto ? (
        ordenados.map((ponto, i) => {
          const c = ponto.colaborador;
          const pos = posicoes[i];
          return (
            <button
              key={c.id}
              type="button"
              {...{ [ATTR_MARCADOR]: "" }}
              className="absolute cursor-grab touch-none active:cursor-grabbing"
              style={{ left: pos.dx, top: pos.dy, transform: "translate(-50%, -100%)" }}
              onPointerDown={(e) => onIniciarArrasto(ponto, e)}
              onMouseEnter={() => onHover(ponto)}
              onMouseLeave={() => onHover(null)}
              aria-label={`${c.nome} — ${c.funcao || "sem função"}`}
            >
              <PinColaborador
                estado={estadoDoPin(c)}
                esmaecido={esmaecidos.has(c.id)}
                arrastando={arrastandoId === c.id}
              />
            </button>
          );
        })
      ) : (
        <button
          type="button"
          {...{ [ATTR_MARCADOR]: "" }}
          className="absolute -translate-x-1/2 -translate-y-full cursor-pointer touch-none"
          onClick={onToggleExpandir}
          onMouseEnter={() => onHover(representante)}
          onMouseLeave={() => onHover(null)}
          aria-expanded={false}
          aria-label={`Abrir ${ordenados.length} colaboradores em ${representante.rotuloLocal ?? "mesma localidade"}`}
        >
          <PinColaborador
            estado={estadoDoPin(representante.colaborador)}
            esmaecido={todosEsmaecidos}
          />
          <span
            className={cn(
              "absolute -right-1.5 -top-1 min-w-[18px] rounded-full px-1 text-center",
              "text-[10px] font-bold leading-[18px] tabular-nums",
              "bg-foreground text-background ring-2 ring-background",
              todosEsmaecidos && "opacity-25",
            )}
          >
            {visiveis.length || ordenados.length}
          </span>
        </button>
      )}
    </div>
  );
};

export default ClusterCidade;
