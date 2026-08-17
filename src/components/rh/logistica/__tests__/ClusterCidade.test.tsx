import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ClusterCidade from "../ClusterCidade";
import { LIMITE_LEQUE_AUTO } from "@/lib/logistica/leque";
import type { PontoColaborador } from "@/hooks/rh/useLogisticaPontos";
import type { Colaborador } from "@/types";

/**
 * `ClusterCidade` é apresentacional e monta sem o mapa — o MapLibre exige WebGL
 * e não sobe em jsdom. Isso deixa testável exatamente a parte onde o bug morava:
 * o pin de um grupo com 2+ pessoas não tinha `onPointerDown`, então ninguém da
 * mesma cidade podia ser arrastado.
 */

const colab = (id: string, nome: string): Colaborador =>
  ({
    id,
    nome,
    funcao: "Eletricista",
    ativo: true,
    obraAtualId: null,
    statusEspecial: null,
    mobilizacaoPendente: null,
    documentos: [],
  }) as unknown as Colaborador;

const ponto = (id: string, nome: string): PontoColaborador => ({
  tipo: "colaborador",
  colaborador: colab(id, nome),
  coord: { lat: -12.6975, lng: -38.3242 },
  origem: "cidade",
  rotuloLocal: "Camaçari/BA",
});

function montar(
  pontos: PontoColaborador[],
  props: Partial<React.ComponentProps<typeof ClusterCidade>> = {},
) {
  const onIniciarArrasto = vi.fn();
  const onToggleExpandir = vi.fn();
  const utils = render(
    <ClusterCidade
      pontos={pontos}
      expandido={false}
      esmaecidos={new Set()}
      arrastandoId={null}
      onToggleExpandir={onToggleExpandir}
      onHover={vi.fn()}
      onIniciarArrasto={onIniciarArrasto}
      {...props}
    />,
  );
  return { ...utils, onIniciarArrasto, onToggleExpandir };
}

const pontos = (n: number) =>
  Array.from({ length: n }, (_, i) => ponto(`c${i}`, `Colaborador ${String(i).padStart(2, "0")}`));

describe("logistica · ClusterCidade", () => {
  it("mostra um pin arrastável quando há só um colaborador", () => {
    const { onIniciarArrasto } = montar([ponto("c1", "Ana")]);

    const pin = screen.getByRole("button", { name: /Ana/ });
    fireEvent.pointerDown(pin);
    expect(onIniciarArrasto).toHaveBeenCalledTimes(1);
    expect(onIniciarArrasto.mock.calls[0][0].colaborador.id).toBe("c1");
  });

  it("abre em leque e deixa cada colaborador da mesma cidade arrastável", () => {
    // O caso do bug: dois na mesma cidade, nenhum dos dois podia ser segurado.
    const { onIniciarArrasto } = montar([ponto("c1", "Ana"), ponto("c2", "Bruno")]);

    const ana = screen.getByRole("button", { name: /Ana/ });
    const bruno = screen.getByRole("button", { name: /Bruno/ });

    fireEvent.pointerDown(ana);
    fireEvent.pointerDown(bruno);

    expect(onIniciarArrasto).toHaveBeenCalledTimes(2);
    expect(onIniciarArrasto.mock.calls.map((c) => c[0].colaborador.id)).toEqual(["c1", "c2"]);
  });

  it("separa os pins do leque em posições distintas", () => {
    montar([ponto("c1", "Ana"), ponto("c2", "Bruno"), ponto("c3", "Carla")]);

    const posicoes = ["Ana", "Bruno", "Carla"].map((nome) => {
      const el = screen.getByRole("button", { name: new RegExp(nome) });
      return `${el.style.left}|${el.style.top}`;
    });

    expect(new Set(posicoes).size).toBe(3);
  });

  it("desenha as linhas-guia numa caixa com tamanho real", () => {
    // Um SVG com width/height zero não é renderizado — a spec desabilita o
    // rendering — e as linhas até o ponto da cidade sumiriam sem aviso.
    const { container } = montar([ponto("c1", "Ana"), ponto("c2", "Bruno")]);

    const svg = container.querySelector("svg[aria-hidden='true']")!;
    expect(Number(svg.getAttribute("width"))).toBeGreaterThan(0);
    expect(Number(svg.getAttribute("height"))).toBeGreaterThan(0);
    expect(svg.querySelectorAll("line")).toHaveLength(2);
  });

  it("ordena o leque por nome, independente da ordem de entrada", () => {
    const { onIniciarArrasto } = montar([ponto("c2", "Bruno"), ponto("c1", "Ana")]);

    const botoes = screen.getAllByRole("button");
    fireEvent.pointerDown(botoes[0]);
    expect(onIniciarArrasto.mock.calls[0][0].colaborador.nome).toBe("Ana");
  });

  it("recolhe grupos grandes atrás de um contador e expande no clique", () => {
    const grandes = pontos(LIMITE_LEQUE_AUTO + 2);
    const { onToggleExpandir, onIniciarArrasto } = montar(grandes);

    // Recolhido: um único botão, que conta o grupo em vez de arrastar.
    const botoes = screen.getAllByRole("button");
    expect(botoes).toHaveLength(1);
    expect(screen.getByText(String(grandes.length))).toBeInTheDocument();

    fireEvent.pointerDown(botoes[0]);
    expect(onIniciarArrasto).not.toHaveBeenCalled();

    fireEvent.click(botoes[0]);
    expect(onToggleExpandir).toHaveBeenCalledTimes(1);
  });

  it("torna todos arrastáveis quando o grupo grande está expandido", () => {
    const grandes = pontos(LIMITE_LEQUE_AUTO + 2);
    const { onIniciarArrasto } = montar(grandes, { expandido: true });

    for (const p of grandes) {
      fireEvent.pointerDown(screen.getByRole("button", { name: new RegExp(p.colaborador.nome) }));
    }
    expect(onIniciarArrasto).toHaveBeenCalledTimes(grandes.length);
  });

  it("mantém o colaborador filtrado no leque, apenas esmaecido", () => {
    // Esmaecer em vez de remover preserva a posição dos vizinhos quando o
    // usuário mexe nos filtros — e o pin some do alcance se for removido.
    const { onIniciarArrasto } = montar([ponto("c1", "Ana"), ponto("c2", "Bruno")], {
      esmaecidos: new Set(["c2"]),
    });

    const bruno = screen.getByRole("button", { name: /Bruno/ });
    fireEvent.pointerDown(bruno);
    expect(onIniciarArrasto).toHaveBeenCalledTimes(1);
  });
});
