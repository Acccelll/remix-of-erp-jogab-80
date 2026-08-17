/** @module-kind pure */
/**
 * Núcleo do otimizador de logística: onde falta gente e quem está mais perto.
 *
 * Duas definições vêm prontas de outros módulos e são reusadas de propósito,
 * para que o mapa e as demais telas nunca discordem sobre os mesmos números:
 *
 * - **efetivo atual** — `montarPreview` de `@/lib/obras/histograma`, a mesma
 *   fórmula do contador da Gestão de Equipe (Board);
 * - **efetivo previsto** — a célula da semana no Histograma
 *   (`celulaKey(obraId, "funcao", nome)`).
 *
 * O déficit é a diferença entre os dois. Se a obra não tem previsão lançada no
 * Histograma, ela simplesmente não aparece com déficit — melhor silêncio do que
 * um número inventado.
 */
import { celulaKey } from "@/lib/obras/histograma";
import { isSpecialStatus } from "@/lib/cards/status-especiais";
import { distanciaKm, type Coordenada } from "@/lib/logistica/haversine";
import type { Colaborador } from "@/types";

/** Colaborador já resolvido para uma posição no mapa. */
export interface ColaboradorLocalizado {
  colaborador: Colaborador;
  /** `null` quando não foi possível geocodificar — entra na lista "sem localização". */
  coord: Coordenada | null;
}

export interface DeficitFuncao {
  funcao: string;
  previsto: number;
  atual: number;
  /** Sempre > 0; funções em dia ou com excedente não entram na lista. */
  deficit: number;
}

export interface CandidatoMobilizacao {
  colaborador: Colaborador;
  funcao: string;
  /** `null` quando o colaborador ou a obra não tem coordenada conhecida. */
  distanciaKm: number | null;
  /** Motivo do posicionamento no ranking, exibido na UI. */
  motivo: string;
}

/**
 * Um colaborador está disponível para mobilização quando está ativo e não
 * alocado numa obra — ou seja, sem `obraAtualId`, ou em status especial
 * (folga/férias/afastamento), que é como o Board trata a coluna "ocioso".
 */
export function estaDisponivel(c: Colaborador): boolean {
  if (!c.ativo) return false;
  if (c.mobilizacaoPendente) return false;
  if (isSpecialStatus(c.statusEspecial ?? null)) return true;
  return !c.obraAtualId;
}

/** Nome de função normalizado do jeito que o Histograma o indexa. */
function funcaoDe(c: Colaborador): string {
  return c.funcao || "Sem função";
}

/**
 * Déficit por função de uma obra, do maior para o menor.
 *
 * @param previstoPorCelula valores do Histograma da semana (`useHistogramaSemana`)
 * @param atualPorCelula    efetivo atual (`montarPreview`)
 */
export function calcularDeficit(
  obraId: string,
  funcoes: string[],
  previstoPorCelula: Map<string, number>,
  atualPorCelula: Map<string, number>,
): DeficitFuncao[] {
  const resultado: DeficitFuncao[] = [];

  for (const funcao of funcoes) {
    const chave = celulaKey(obraId, "funcao", funcao);
    const previsto = previstoPorCelula.get(chave) ?? 0;
    if (previsto <= 0) continue;

    const atual = atualPorCelula.get(chave) ?? 0;
    const deficit = previsto - atual;
    if (deficit > 0) resultado.push({ funcao, previsto, atual, deficit });
  }

  return resultado.sort(
    (a, b) => b.deficit - a.deficit || a.funcao.localeCompare(b.funcao, "pt-BR"),
  );
}

/**
 * Ranqueia colaboradores disponíveis para uma obra.
 *
 * A ordem é: quem exerce uma função em déficit primeiro (e, entre eles, a
 * função com maior déficit), depois por distância crescente. Quem não tem
 * coordenada conhecida vai para o fim — continua listado, porque excluí-lo
 * esconderia um candidato válido só por falta de cadastro.
 */
export function ranquearCandidatos(args: {
  destino: Coordenada | null;
  candidatos: ColaboradorLocalizado[];
  deficits: DeficitFuncao[];
  /** Limita o resultado; sem valor, devolve todos. */
  limite?: number;
}): CandidatoMobilizacao[] {
  const { destino, candidatos, deficits, limite } = args;

  const deficitPorFuncao = new Map(deficits.map((d) => [d.funcao, d.deficit]));

  const ranqueados = candidatos
    .filter(({ colaborador }) => estaDisponivel(colaborador))
    .map(({ colaborador, coord }) => {
      const funcao = funcaoDe(colaborador);
      const deficit = deficitPorFuncao.get(funcao) ?? 0;
      const dist = destino && coord ? distanciaKm(coord, destino) : null;

      let motivo: string;
      if (deficit > 0 && dist !== null) {
        motivo = `${funcao} em déficit (${deficit}) · ${formatarDistancia(dist)}`;
      } else if (deficit > 0) {
        motivo = `${funcao} em déficit (${deficit}) · sem localização`;
      } else if (dist !== null) {
        motivo = `Disponível · ${formatarDistancia(dist)}`;
      } else {
        motivo = "Disponível · sem localização";
      }

      return { colaborador, funcao, distanciaKm: dist, motivo, _deficit: deficit };
    })
    .sort((a, b) => {
      // 1) função em déficit vence função sem déficit
      if (a._deficit > 0 !== b._deficit > 0) return a._deficit > 0 ? -1 : 1;
      // 2) entre funções em déficit, a mais carente primeiro
      if (a._deficit !== b._deficit) return b._deficit - a._deficit;
      // 3) quem tem coordenada vence quem não tem
      if ((a.distanciaKm === null) !== (b.distanciaKm === null)) {
        return a.distanciaKm === null ? 1 : -1;
      }
      // 4) mais perto primeiro
      if (a.distanciaKm !== null && b.distanciaKm !== null && a.distanciaKm !== b.distanciaKm) {
        return a.distanciaKm - b.distanciaKm;
      }
      return a.colaborador.nome.localeCompare(b.colaborador.nome, "pt-BR");
    })
    .map(({ _deficit, ...c }) => c);

  return typeof limite === "number" ? ranqueados.slice(0, limite) : ranqueados;
}

/** "12 km" / "1.240 km" / "800 m" — formato curto para pin e painel. */
export function formatarDistancia(km: number): string {
  if (!Number.isFinite(km)) return "—";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1).replace(".", ",")} km`;
  return `${Math.round(km).toLocaleString("pt-BR")} km`;
}

/** "45 min" / "3 h 20 min" — formato curto para pin e painel. */
export function formatarDuracao(minutos: number): string {
  if (!Number.isFinite(minutos) || minutos < 0) return "—";
  const total = Math.round(minutos);
  if (total < 60) return `${total} min`;
  const horas = Math.floor(total / 60);
  const resto = total % 60;
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
}
