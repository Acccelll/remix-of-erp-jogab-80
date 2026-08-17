/** @module-kind io */
/**
 * Índice de municípios brasileiros para geocodificação offline.
 *
 * Carrega `public/geo/municipios-br.json` (5.571 municípios do IBGE, ~220 KB)
 * sob demanda e monta os índices em memória. Fica fora do bundle de propósito:
 * só quem abre a tela de logística paga o download, e o navegador cacheia.
 *
 * A promise é memoizada no módulo, então múltiplos componentes montando ao
 * mesmo tempo compartilham uma única requisição.
 */
import {
  candidatosCidade,
  chaveMunicipio,
  normalizeUF,
  parseCidadeUF,
  slugCidade,
  type UF,
} from "@/lib/logistica/normalize";
import type { Coordenada } from "@/lib/logistica/haversine";
import { logger } from "@/lib/core/logger";

export const MUNICIPIOS_URL = "/geo/municipios-br.json";

export interface Municipio extends Coordenada {
  nome: string;
  uf: UF;
}

/** Tupla compacta como o arquivo armazena: `[nome, uf, lat, lng]`. */
type MunicipioTupla = [string, string, number, number];

interface ArquivoMunicipios {
  fonte?: string;
  total?: number;
  municipios: MunicipioTupla[];
}

export interface IndiceMunicipios {
  /** `slug(nome)|UF` → município. Busca exata quando a UF é conhecida. */
  porChave: Map<string, Municipio>;
  /** `slug(nome)` → todos os municípios homônimos, em qualquer UF. */
  porNome: Map<string, Municipio[]>;
  /** Lista completa, ordenada por UF e nome — alimenta os comboboxes. */
  todos: Municipio[];
}

function construirIndice(tuplas: MunicipioTupla[]): IndiceMunicipios {
  const porChave = new Map<string, Municipio>();
  const porNome = new Map<string, Municipio[]>();
  const todos: Municipio[] = [];

  for (const [nome, ufBruta, lat, lng] of tuplas) {
    const uf = normalizeUF(ufBruta);
    if (!uf || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const municipio: Municipio = { nome, uf, lat, lng };
    todos.push(municipio);
    porChave.set(chaveMunicipio(nome, uf), municipio);

    const slug = slugCidade(nome);
    const homonimos = porNome.get(slug);
    if (homonimos) homonimos.push(municipio);
    else porNome.set(slug, [municipio]);
  }

  return { porChave, porNome, todos };
}

const INDICE_VAZIO: IndiceMunicipios = {
  porChave: new Map(),
  porNome: new Map(),
  todos: [],
};

let promessa: Promise<IndiceMunicipios> | null = null;

/**
 * Carrega (uma única vez) e devolve o índice de municípios.
 *
 * Falha de rede não derruba a tela: loga e devolve um índice vazio, o que faz
 * a geocodificação por cidade retornar `null` e os pontos caírem na lista
 * "sem localização". Coordenadas já gravadas no banco continuam funcionando.
 */
export function carregarMunicipios(): Promise<IndiceMunicipios> {
  if (!promessa) {
    promessa = fetch(MUNICIPIOS_URL)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const dados = (await res.json()) as ArquivoMunicipios;
        if (!Array.isArray(dados?.municipios)) {
          throw new Error("formato inesperado: campo `municipios` ausente");
        }
        return construirIndice(dados.municipios);
      })
      .catch((err) => {
        logger.warn("municipios: falha ao carregar base geográfica", { err });
        // Zera a memoização para que uma nova montagem possa tentar de novo.
        promessa = null;
        return INDICE_VAZIO;
      });
  }
  return promessa;
}

/** Busca direta no índice, sem tolerância a texto combinado. */
function buscaExata(indice: IndiceMunicipios, cidade: string, uf: string | null): Municipio | null {
  if (uf) return indice.porChave.get(chaveMunicipio(cidade, uf)) ?? null;

  const candidatos = indice.porNome.get(slugCidade(cidade));
  if (!candidatos || candidatos.length !== 1) return null;
  return candidatos[0];
}

/**
 * Resolve cidade (+ UF opcional) em coordenada.
 *
 * Com UF, a busca é exata. Sem UF, só resolve quando o nome é único no país —
 * "Bom Jesus" existe em 8 estados e devolver qualquer um deles colocaria a
 * pessoa a milhares de quilômetros do lugar certo, o que é pior que não
 * mostrar no mapa.
 *
 * Quando a busca direta falha, reprocessa a entrada com `parseCidadeUF` antes
 * de desistir. Isso é necessário porque os campos de cidade da base guardam o
 * par combinado numa string só ("Rio Claro/SP") — formato que o próprio
 * sistema grava ao preencher o cadastro pelo CEP. A UF embutida no texto tem
 * precedência sobre o argumento `uf` apenas quando este vem vazio.
 */
export function geocodeCidade(
  indice: IndiceMunicipios,
  cidade: string | null | undefined,
  uf?: string | null,
): Municipio | null {
  if (!cidade) return null;

  const ufNormalizada = normalizeUF(uf);
  const direto = buscaExata(indice, cidade, ufNormalizada);
  if (direto) return direto;

  const parseado = parseCidadeUF(cidade);
  if (!parseado.cidade) return null;

  const ufFinal = ufNormalizada ?? parseado.uf;
  // Sem UF nova e sem nome novo não há segunda tentativa a fazer.
  if (!ufFinal && slugCidade(parseado.cidade) === slugCidade(cidade)) return null;

  for (const candidato of candidatosCidade(parseado.cidade)) {
    const achado = buscaExata(indice, candidato, ufFinal);
    if (achado) return achado;
  }
  return null;
}

/** Municípios homônimos de um nome, em todas as UFs. Vazio se não existir. */
export function municipiosHomonimos(
  indice: IndiceMunicipios,
  cidade: string | null | undefined,
): Municipio[] {
  if (!cidade) return [];
  return indice.porNome.get(slugCidade(cidade)) ?? [];
}

/** Reseta a memoização — usado apenas pelos testes. */
export function __resetMunicipiosCache(): void {
  promessa = null;
}
