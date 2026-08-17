/** @module-kind pure */
/**
 * Resolução do alvo de soltura no mapa de logística.
 *
 * Por que hit-test geométrico e não `pointerenter`: o arrasto do pin captura o
 * ponteiro (`setPointerCapture`) para o gesto não virar pan do MapLibre, e a
 * captura redireciona **todos** os eventos de ponteiro para o elemento que
 * capturou. O pin da obra é irmão, não ancestral — o `pointerenter` dele nunca
 * dispara enquanto o arrasto corre. Foi exatamente isso que fez o arrasto até
 * a obra não produzir nada.
 *
 * `elementFromPoint` decide pela posição na tela, então é indiferente a quem
 * detém a captura. Fica aqui, fora do componente, porque o mapa não roda em
 * jsdom (MapLibre exige WebGL) mas este hit-test roda — e era justamente a
 * parte não exercitada por teste nenhum.
 */

/** Atributo que marca um elemento como alvo válido de mobilização. */
export const ATTR_OBRA_ALVO = "data-obra-id";

/**
 * Atributo presente em todo pin do mapa — de obra ou de colaborador.
 *
 * Os `Marker` do MapLibre são filhos do mesmo `canvasContainer` onde ele
 * registra os próprios listeners, então clicar num pin também dispara o
 * `click` do mapa. E o React delega no root da aplicação, *acima* do canvas:
 * o handler do MapLibre roda primeiro, e nenhum `stopPropagation` do React
 * chega a tempo de impedir. Daí o filtro ser por posição na árvore, e não por
 * propagação — mesma escolha de `obraIdSobPonto`.
 */
export const ATTR_MARCADOR = "data-pin-mapa";

/** `true` quando o alvo do evento está dentro de um pin do mapa. */
export function dentroDeMarcador(alvo: EventTarget | null | undefined): boolean {
  // `alvo` pode ser o próprio documento ou a janela; nem todo EventTarget tem
  // `closest`, por isso o encadeamento opcional em vez de um cast otimista.
  const elemento = alvo as Element | null | undefined;
  return !!elemento?.closest?.(`[${ATTR_MARCADOR}]`);
}

/**
 * ID da obra sob o ponto da tela, ou `null` se ali não houver alvo válido.
 *
 * Usa `closest` porque o elemento no topo costuma ser um descendente do pin —
 * o `<path>` do SVG, não o `<button>` que carrega o atributo.
 *
 * @param x coordenada horizontal na viewport (`clientX`)
 * @param y coordenada vertical na viewport (`clientY`)
 * @param doc injetável para teste; em produção é o `document`
 */
export function obraIdSobPonto(
  x: number,
  y: number,
  doc: Pick<Document, "elementFromPoint"> = document,
): string | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  // `null` quando o ponteiro sai da viewport durante o arrasto.
  const alvo = doc.elementFromPoint(x, y);
  if (!alvo) return null;

  const pin = alvo.closest?.(`[${ATTR_OBRA_ALVO}]`);
  const id = pin?.getAttribute(ATTR_OBRA_ALVO);
  // Atributo presente mas vazio não é alvo válido.
  return id || null;
}
