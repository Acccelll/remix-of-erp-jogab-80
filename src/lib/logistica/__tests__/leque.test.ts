import { describe, expect, it } from "vitest";
import { LIMITE_ANEL, LIMITE_LEQUE_AUTO, posicoesLeque } from "@/lib/logistica/leque";

/**
 * A geometria vive fora do componente justamente para ser testada sem MapLibre
 * (que exige WebGL e não sobe em jsdom). O que importa aqui é o contrato que a
 * UI depende: uma posição por pin, distintas entre si e estáveis entre chamadas.
 */

const raio = ({ dx, dy }: { dx: number; dy: number }) => Math.hypot(dx, dy);
const chave = ({ dx, dy }: { dx: number; dy: number }) => `${dx},${dy}`;

/**
 * Agrupa as posições por raio com tolerância de 1 px: os deslocamentos são
 * arredondados para uma casa decimal, então pins do mesmo anel não fecham em
 * um valor idêntico de `hypot`. O que interessa é quantos anéis existem.
 */
function aneis(n: number): number[] {
  const grupos: number[] = [];
  for (const r of posicoesLeque(n).map(raio)) {
    if (!grupos.some((g) => Math.abs(g - r) < 1)) grupos.push(r);
  }
  return grupos;
}

describe("logistica · posicoesLeque", () => {
  it("devolve lista vazia para grupo vazio ou inválido", () => {
    expect(posicoesLeque(0)).toEqual([]);
    expect(posicoesLeque(-3)).toEqual([]);
  });

  it("mantém o pin solitário exatamente sobre a coordenada", () => {
    // Regressão de comportamento: quem mora sozinho numa cidade não pode
    // ganhar deslocamento nenhum, senão o pin passa a mentir a posição.
    expect(posicoesLeque(1)).toEqual([{ dx: 0, dy: 0 }]);
  });

  it("devolve uma posição por pin, sem repetir, de 2 até 40", () => {
    for (let n = 2; n <= 40; n++) {
      const posicoes = posicoesLeque(n);
      expect(posicoes).toHaveLength(n);
      expect(new Set(posicoes.map(chave)).size).toBe(n);
    }
  });

  it("afasta todo pin da âncora quando há disputa pelo ponto", () => {
    for (let n = 2; n <= 40; n++) {
      for (const pos of posicoesLeque(n)) {
        expect(raio(pos)).toBeGreaterThan(20);
      }
    }
  });

  it("nunca joga um pin abaixo da âncora nos grupos que nascem abertos", () => {
    // Até 4 o leque já vem aberto sobre o mapa. Descer um pin cobriria a
    // região logo abaixo da cidade, que é justamente onde o usuário está lendo.
    for (let n = 2; n <= LIMITE_LEQUE_AUTO; n++) {
      for (const pos of posicoesLeque(n)) {
        expect(pos.dy).toBeLessThanOrEqual(0);
      }
    }
  });

  it("mantém o leque simétrico em torno da vertical", () => {
    for (let n = 2; n <= 5; n++) {
      const soma = posicoesLeque(n).reduce((s, p) => s + p.dx, 0);
      expect(Math.abs(soma)).toBeLessThan(0.5);
    }
  });

  it("usa um anel só até o limite e dois acima dele", () => {
    expect(aneis(2)).toHaveLength(1);
    expect(aneis(LIMITE_ANEL)).toHaveLength(1);
    expect(aneis(LIMITE_ANEL + 1)).toHaveLength(2);
    expect(aneis(25)).toHaveLength(2);
  });

  it("distribui os dois anéis sem deixar nenhum vazio", () => {
    for (let n = LIMITE_ANEL + 1; n <= 40; n++) {
      const raios = aneis(n);
      expect(raios).toHaveLength(2);

      const [interno, externo] = raios.slice().sort((a, b) => a - b);
      const noAnel = (alvo: number) =>
        posicoesLeque(n).filter((p) => Math.abs(raio(p) - alvo) < 1).length;

      expect(noAnel(interno)).toBeGreaterThan(0);
      expect(noAnel(externo)).toBeGreaterThan(0);
      expect(noAnel(interno) + noAnel(externo)).toBe(n);
      // O anel externo é mais comprido, então tem que carregar mais gente.
      expect(noAnel(externo)).toBeGreaterThanOrEqual(noAnel(interno));
    }
  });

  it("é determinística — a mesma entrada devolve a mesma saída", () => {
    // A UI reordena os pontos por nome e confia que o pin não pula de lugar
    // entre renders; se esta função variasse, o alvo escaparia do cursor.
    expect(posicoesLeque(7)).toEqual(posicoesLeque(7));
    expect(posicoesLeque(13)).toEqual(posicoesLeque(13));
  });
});
