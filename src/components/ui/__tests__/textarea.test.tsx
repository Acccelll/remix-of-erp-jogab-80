import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

import { Textarea } from "../textarea";

/**
 * A Observação da Solicitação Financeira mora dentro de um corpo que já rola.
 * Com a altura fixa de 80px do primitivo, um texto longo abria uma segunda
 * barra dentro da primeira. `autoResize` existe para isso — e é opt-in, porque
 * as outras dezenas de usos da base contam com a altura fixa.
 *
 * O jsdom não faz layout: `scrollHeight` é sempre 0. Sem substituir o getter,
 * qualquer asserção sobre altura passaria por acidente (0 === 0). O dublê abaixo
 * devolve uma altura proporcional ao número de linhas — e, como no browser,
 * nunca menor que a altura já aplicada à caixa. Essa segunda metade é o que dá
 * sentido ao teste de encolher: é justamente por `scrollHeight` não baixar
 * sozinho que o componente precisa zerar a altura antes de medir. Um dublê que
 * ignorasse a altura aplicada deixaria a remoção do reset passar batida.
 */
const ALTURA_LINHA = 20;
const PADDING = 16;
let scrollHeightOriginal: PropertyDescriptor | undefined;

beforeAll(() => {
  scrollHeightOriginal = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollHeight");
  Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", {
    configurable: true,
    get(this: HTMLTextAreaElement) {
      const linhas = this.value === "" ? 1 : this.value.split("\n").length;
      const conteudo = PADDING + linhas * ALTURA_LINHA;
      // `scrollHeight` nunca fica abaixo da altura visível da caixa. Com a
      // altura anterior ainda aplicada, medir devolve ela mesma — e a caixa
      // jamais encolheria. Zerar antes é o que solta esse trava.
      const aplicada = this.style.height.endsWith("px") ? Number.parseFloat(this.style.height) : 0;
      return Math.max(conteudo, aplicada);
    },
  });
});

afterAll(() => {
  Reflect.deleteProperty(HTMLTextAreaElement.prototype, "scrollHeight");
  if (scrollHeightOriginal) {
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", scrollHeightOriginal);
  }
});

const alturaDe = (el: HTMLElement) => el.style.height;
const linhas = (n: number) => `${PADDING + n * ALTURA_LINHA}px`;

/** Controlado, como na página: o valor vem do estado do pai. */
function Controlado({ inicial }: { inicial: string }) {
  const [valor, setValor] = React.useState(inicial);
  return (
    <Textarea
      autoResize
      aria-label="obs"
      value={valor}
      onChange={(e) => setValor(e.target.value)}
    />
  );
}

describe("Textarea · autoResize", () => {
  it("já monta na altura do conteúdo que recebeu", () => {
    // O caso de editar uma solicitação: o texto chega junto com o diálogo, sem
    // ninguém digitar. Medir só no `onInput` deixaria a caixa espremida aqui.
    render(<Controlado inicial={"a\nb\nc\nd\ne"} />);
    expect(alturaDe(screen.getByLabelText("obs"))).toBe(linhas(5));
  });

  it("cresce conforme o texto ganha linhas", () => {
    render(<Controlado inicial="a" />);
    const campo = screen.getByLabelText("obs");
    expect(alturaDe(campo)).toBe(linhas(1));

    fireEvent.change(campo, { target: { value: "a\nb\nc" } });
    expect(alturaDe(campo)).toBe(linhas(3));
  });

  it("encolhe de volta quando o texto diminui", () => {
    // O que quebra se o `height = "auto"` antes da medição sumir: `scrollHeight`
    // nunca devolve menos do que a altura já aplicada, e a caixa só cresceria.
    render(<Controlado inicial={"a\nb\nc\nd\ne\nf"} />);
    const campo = screen.getByLabelText("obs");
    expect(alturaDe(campo)).toBe(linhas(6));

    fireEvent.change(campo, { target: { value: "a" } });
    expect(alturaDe(campo)).toBe(linhas(1));
  });

  it("acompanha digitação mesmo sem valor controlado", () => {
    render(<Textarea autoResize aria-label="obs" defaultValue="a" />);
    const campo = screen.getByLabelText("obs");

    fireEvent.input(campo, { target: { value: "a\nb\nc\nd" } });
    expect(alturaDe(campo)).toBe(linhas(4));
  });

  it("desliga a alça nativa, que brigaria com a altura calculada", () => {
    render(<Textarea autoResize aria-label="obs" />);
    expect(screen.getByLabelText("obs").className).toContain("resize-none");
    expect(screen.getByLabelText("obs").className).toContain("overflow-hidden");
  });

  it("sem a prop, o primitivo continua exatamente como era", () => {
    // A garantia para os outros usos da base: nada de altura inline, nada de
    // `resize-none`, e o piso de 80px no lugar.
    render(<Textarea aria-label="obs" defaultValue={"a\nb\nc\nd\ne"} />);
    const campo = screen.getByLabelText("obs");

    expect(alturaDe(campo)).toBe("");
    expect(campo.className).not.toContain("resize-none");
    expect(campo.className).toContain("min-h-[80px]");

    fireEvent.input(campo, { target: { value: "a\nb\nc\nd\ne\nf\ng" } });
    expect(alturaDe(campo)).toBe("");
  });

  it("encaminha o ref para o mesmo elemento que mede", () => {
    const ref = React.createRef<HTMLTextAreaElement>();
    render(<Textarea autoResize aria-label="obs" ref={ref} defaultValue="a" />);
    expect(ref.current).toBe(screen.getByLabelText("obs"));
  });
});
