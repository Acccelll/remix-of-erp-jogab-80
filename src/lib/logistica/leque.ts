/** @module-kind pure */
/**
 * Geometria do leque de pins que dividem a mesma coordenada.
 *
 * A geocodificação da logística é por centróide de município, então todo
 * colaborador da mesma cidade cai no *mesmo* ponto. Empilhar os pins deixava
 * só o de cima acessível — e, pior, o pin do grupo nem arrasto tinha. Aqui os
 * pins abrem em torno da âncora para que cada um possa ser agarrado.
 *
 * Os deslocamentos são em **pixels de tela**, não em graus: o leque tem que
 * manter o mesmo tamanho em qualquer zoom, já que o problema que ele resolve é
 * de legibilidade na tela, não de geografia.
 *
 * Fica fora do componente porque é a parte testável sem montar o MapLibre, que
 * exige WebGL e não roda em jsdom.
 */

/** Acima deste tamanho o grupo começa recolhido e o leque abre no toque. */
export const LIMITE_LEQUE_AUTO = 4;

/** Acima deste tamanho o leque passa a usar dois anéis concêntricos. */
export const LIMITE_ANEL = 8;

/** A partir daqui o anel fecha o círculo em vez de desenhar um arco. */
const MINIMO_CIRCULO_COMPLETO = 6;

const RAIO_MINIMO_PX = 24;
const ESPACO_POR_PIN_PX = 3;
const PROPORCAO_ANEL_EXTERNO = 1.8;
/** Espaçamento desejado entre pins vizinhos de um arco. */
const PASSO_ARCO_GRAUS = 60;
/** Arco não passa disto para os pins das pontas não se encostarem. */
const ARCO_MAXIMO_GRAUS = 300;
/** Fase inicial: o leque abre para cima, deixando o mapa abaixo à mostra. */
const FASE_GRAUS = -90;

export interface DeslocamentoLeque {
  /** Deslocamento horizontal em pixels a partir da coordenada real. */
  dx: number;
  /** Deslocamento vertical em pixels; negativo é para cima. */
  dy: number;
}

/** Uma casa decimal basta para posicionar em CSS e mantém o teste determinístico. */
function arredondar(valor: number): number {
  return Math.round(valor * 10) / 10;
}

/** Distribui `quantidade` pins sobre um anel de raio fixo. */
function anel(quantidade: number, raio: number): DeslocamentoLeque[] {
  if (quantidade <= 0) return [];
  if (quantidade === 1) return [{ dx: 0, dy: arredondar(-raio) }];

  const circuloCompleto = quantidade >= MINIMO_CIRCULO_COMPLETO;
  const passo = circuloCompleto
    ? 360 / quantidade
    : Math.min(PASSO_ARCO_GRAUS, ARCO_MAXIMO_GRAUS / (quantidade - 1));
  // O arco fica centrado na vertical; o círculo completo só precisa da fase.
  const inicio = circuloCompleto ? FASE_GRAUS : FASE_GRAUS - (passo * (quantidade - 1)) / 2;

  return Array.from({ length: quantidade }, (_, i) => {
    const radianos = ((inicio + passo * i) * Math.PI) / 180;
    return {
      dx: arredondar(raio * Math.cos(radianos)),
      dy: arredondar(raio * Math.sin(radianos)),
    };
  });
}

/**
 * Posições dos `n` pins de um grupo, na ordem em que os pontos são informados.
 *
 * Um ponto sozinho fica exatamente sobre a coordenada — é o comportamento que
 * já existia e o que o usuário espera de um pin que não disputa espaço.
 *
 * @param n quantidade de pins no grupo
 */
export function posicoesLeque(n: number): DeslocamentoLeque[] {
  if (n <= 0) return [];
  if (n === 1) return [{ dx: 0, dy: 0 }];

  if (n <= LIMITE_ANEL) {
    return anel(n, RAIO_MINIMO_PX + ESPACO_POR_PIN_PX * n);
  }

  // Dois anéis: a capacidade de cada um acompanha o próprio perímetro, senão o
  // anel interno fica apertado enquanto o externo sobra.
  const raioInterno = RAIO_MINIMO_PX + ESPACO_POR_PIN_PX * LIMITE_ANEL;
  const raioExterno = raioInterno * PROPORCAO_ANEL_EXTERNO;
  const interno = Math.max(1, Math.round((n * raioInterno) / (raioInterno + raioExterno)));
  const externo = n - interno;
  if (externo <= 0) return anel(n, raioInterno);

  return [...anel(interno, raioInterno), ...anel(externo, raioExterno)];
}
