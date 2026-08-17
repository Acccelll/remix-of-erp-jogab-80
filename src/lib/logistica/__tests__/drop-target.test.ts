import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ATTR_MARCADOR,
  ATTR_OBRA_ALVO,
  dentroDeMarcador,
  obraIdSobPonto,
} from "@/lib/logistica/drop-target";

/**
 * `elementFromPoint` não faz layout de verdade no jsdom, então o teste injeta
 * um documento falso que devolve o elemento escolhido. O que está sob teste é
 * a resolução a partir do elemento — subir a árvore, ler o atributo, recusar o
 * que não é alvo — que é onde o bug morava.
 */
function docComAlvo(elemento: Element | null): Pick<Document, "elementFromPoint"> {
  return { elementFromPoint: () => elemento } as Pick<Document, "elementFromPoint">;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("logistica · obraIdSobPonto", () => {
  it("devolve o id quando o próprio elemento é o pin", () => {
    const botao = document.createElement("button");
    botao.setAttribute(ATTR_OBRA_ALVO, "42");

    expect(obraIdSobPonto(100, 200, docComAlvo(botao))).toBe("42");
  });

  it("sobe a árvore a partir de um descendente do pin", () => {
    // É o caso real: o cursor encontra o <path> do SVG, não o <button>.
    document.body.innerHTML = `
      <button ${ATTR_OBRA_ALVO}="7">
        <svg><path id="icone" d="M0 0"></path></svg>
      </button>`;
    const path = document.getElementById("icone")!;

    expect(obraIdSobPonto(10, 10, docComAlvo(path))).toBe("7");
  });

  it("devolve null quando o ponto cai no mapa, fora de qualquer pin", () => {
    const canvas = document.createElement("canvas");
    document.body.appendChild(canvas);

    expect(obraIdSobPonto(10, 10, docComAlvo(canvas))).toBeNull();
  });

  it("devolve null quando não há elemento sob o ponto", () => {
    // Acontece quando o ponteiro sai da viewport durante o arrasto.
    expect(obraIdSobPonto(10, 10, docComAlvo(null))).toBeNull();
  });

  it("devolve null para coordenada inválida", () => {
    const botao = document.createElement("button");
    botao.setAttribute(ATTR_OBRA_ALVO, "1");
    const doc = docComAlvo(botao);

    expect(obraIdSobPonto(NaN, 10, doc)).toBeNull();
    expect(obraIdSobPonto(10, Infinity, doc)).toBeNull();
  });

  it("não aceita atributo presente porém vazio", () => {
    const botao = document.createElement("button");
    botao.setAttribute(ATTR_OBRA_ALVO, "");

    expect(obraIdSobPonto(10, 10, docComAlvo(botao))).toBeNull();
  });

  it("escolhe o pin mais próximo quando há aninhamento", () => {
    document.body.innerHTML = `
      <div ${ATTR_OBRA_ALVO}="externo">
        <button ${ATTR_OBRA_ALVO}="interno"><span id="alvo"></span></button>
      </div>`;
    const span = document.getElementById("alvo")!;

    expect(obraIdSobPonto(10, 10, docComAlvo(span))).toBe("interno");
  });

  it("resolve mesmo com o ponteiro capturado por outro elemento", () => {
    // Regressão do bug original: a detecção por `pointerenter` falhava porque
    // `setPointerCapture` no pin do colaborador desviava todos os eventos de
    // ponteiro para ele. O hit-test é geométrico e ignora a captura.
    document.body.innerHTML = `
      <button id="pin-colaborador"></button>
      <button ${ATTR_OBRA_ALVO}="99"><span id="pin-obra"></span></button>`;

    const pinColaborador = document.getElementById("pin-colaborador")! as HTMLElement & {
      setPointerCapture: (id: number) => void;
    };
    pinColaborador.setPointerCapture = vi.fn();
    pinColaborador.setPointerCapture(1);

    const pinObra = document.getElementById("pin-obra")!;
    expect(obraIdSobPonto(10, 10, docComAlvo(pinObra))).toBe("99");
  });
});

/**
 * O clique num pin também chega ao mapa: os `Marker` são filhos do mesmo
 * `canvasContainer` que o MapLibre escuta, e ele dispara antes do React. Sem
 * este filtro, abrir um grupo ou selecionar uma obra brigava com a limpeza de
 * estado do `onClick` do mapa.
 */
describe("logistica · dentroDeMarcador", () => {
  it("reconhece o próprio marcador", () => {
    const botao = document.createElement("button");
    botao.setAttribute(ATTR_MARCADOR, "");

    expect(dentroDeMarcador(botao)).toBe(true);
  });

  it("reconhece um descendente do marcador", () => {
    // É o caso real: o alvo do clique costuma ser o <path> do SVG do pin.
    document.body.innerHTML = `
      <button ${ATTR_MARCADOR}=""><svg><path id="icone" d="M0 0"></path></svg></button>`;

    expect(dentroDeMarcador(document.getElementById("icone"))).toBe(true);
  });

  it("recusa cliques no canvas do mapa", () => {
    document.body.innerHTML = `<canvas id="mapa"></canvas>`;

    expect(dentroDeMarcador(document.getElementById("mapa"))).toBe(false);
  });

  it("recusa alvo ausente ou sem closest", () => {
    expect(dentroDeMarcador(null)).toBe(false);
    expect(dentroDeMarcador(undefined)).toBe(false);
    expect(dentroDeMarcador(document)).toBe(false);
  });
});
