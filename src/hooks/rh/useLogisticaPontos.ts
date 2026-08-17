// Logística — derivação dos pontos geolocalizados de colaboradores e obras.
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useColaboradores } from "@/hooks/rh/useColaboradores";
import { useObras } from "@/hooks/obras/useObras";
import { queryKey } from "@/lib/query-keys";
import {
  carregarMunicipios,
  geocodeCidade,
  type IndiceMunicipios,
} from "@/lib/logistica/municipios";
import { parseCidadeUF, normalizeUF } from "@/lib/logistica/normalize";
import { ufPorCep } from "@/lib/logistica/cep-uf";
import type { Coordenada } from "@/lib/logistica/haversine";
import { useOverridesLogistica, type OverridesLogistica } from "@/lib/logistica/overrides";
import type { Colaborador, Obra } from "@/types";

/** De onde saiu a coordenada — a UI mostra isso para justificar a posição. */
export type OrigemCoordenada = "exata" | "cidade" | "local" | "manual";

/**
 * Por que um ponto ficou sem coordenada. A distinção importa porque leva a
 * ações diferentes: "sem-cadastro" pede preenchimento, "nao-reconhecida"
 * quase sempre é erro de digitação num município que existe.
 */
export type MotivoSemLocal = "sem-cadastro" | "nao-reconhecida";

export interface PontoColaborador {
  tipo: "colaborador";
  colaborador: Colaborador;
  coord: Coordenada | null;
  origem: OrigemCoordenada | null;
  /** Rótulo "Cidade/UF" já pronto para exibição, ou `null`. */
  rotuloLocal: string | null;
  /** Preenchido só quando `coord` é `null`. */
  motivoSemLocal?: MotivoSemLocal;
}

export interface PontoObra {
  tipo: "obra";
  obra: Obra;
  coord: Coordenada | null;
  origem: OrigemCoordenada | null;
  rotuloLocal: string | null;
  motivoSemLocal?: MotivoSemLocal;
}

export const logisticaKeys = {
  municipios: queryKey("logistica-municipios"),
};

/** Índice de municípios sob React Query — compartilhado por toda a tela. */
export function useMunicipios() {
  return useQuery({
    queryKey: logisticaKeys.municipios,
    queryFn: carregarMunicipios,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

const coordValida = (lat?: number, lng?: number): Coordenada | null =>
  Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)
    ? { lat: lat as number, lng: lng as number }
    : null;

const rotulo = (cidade?: string | null, uf?: string | null): string | null => {
  if (!cidade) return uf ? String(uf).toUpperCase() : null;
  return uf ? `${cidade}/${String(uf).toUpperCase()}` : cidade;
};

/**
 * Resolve a posição de um colaborador.
 *
 * Precedência, do mais confiável ao menos:
 * 1. override manual (pin ajustado à mão, salvo em localStorage);
 * 2. coordenada gravada no cadastro (latitude/longitude);
 * 3. cidade + UF na base do IBGE — o `geocodeCidade` já tolera o par vindo
 *    combinado numa string só ("Rio Claro/SP"), que é como a maior parte da
 *    base está preenchida;
 * 4. cidade + UF deduzida da faixa do CEP, para os homônimos que sobram
 *    ("Rio Claro" sozinho poderia ser SP ou RJ).
 *
 * O endereço livre do cadastro nunca entra: não tem formato garantido, e
 * chutar a partir dele erraria mais do que acertaria.
 */
function localizarColaborador(
  c: Colaborador,
  indice: IndiceMunicipios,
  overrides: OverridesLogistica = { colaboradores: {}, obras: {} },
): PontoColaborador {
  const override = overrides.colaboradores[c.id];
  if (override) {
    return {
      tipo: "colaborador",
      colaborador: c,
      coord: override,
      origem: "manual",
      rotuloLocal: rotulo(c.cidade, c.uf),
    };
  }

  const exata = coordValida(c.latitude, c.longitude);
  if (exata) {
    return {
      tipo: "colaborador",
      colaborador: c,
      coord: exata,
      origem: "exata",
      rotuloLocal: rotulo(c.cidade, c.uf),
    };
  }

  const municipio =
    geocodeCidade(indice, c.cidade, c.uf) ?? geocodeCidade(indice, c.cidade, ufPorCep(c.cep));

  if (municipio) {
    return {
      tipo: "colaborador",
      colaborador: c,
      coord: { lat: municipio.lat, lng: municipio.lng },
      origem: "cidade",
      rotuloLocal: rotulo(municipio.nome, municipio.uf),
    };
  }

  return {
    tipo: "colaborador",
    colaborador: c,
    coord: null,
    origem: null,
    rotuloLocal: rotulo(c.cidade, c.uf),
    motivoSemLocal: c.cidade?.trim() ? "nao-reconhecida" : "sem-cadastro",
  };
}

/**
 * Resolve a posição de uma obra.
 *
 * Além da coordenada exata e do par cidade/UF, tenta extrair a cidade do campo
 * livre `local`, que é onde a informação esteve até a migração de 2026-07-26 —
 * é o que faz o mapa já nascer povoado, sem exigir recadastro.
 */
function localizarObra(
  o: Obra,
  indice: IndiceMunicipios,
  overrides: OverridesLogistica = { colaboradores: {}, obras: {} },
): PontoObra {
  const override = overrides.obras[o.id];
  if (override) {
    return {
      tipo: "obra",
      obra: o,
      coord: override,
      origem: "manual",
      rotuloLocal: rotulo(o.cidade, o.uf) ?? o.local ?? null,
    };
  }

  const exata = coordValida(o.latitude, o.longitude);
  if (exata) {
    return {
      tipo: "obra",
      obra: o,
      coord: exata,
      origem: "exata",
      rotuloLocal: rotulo(o.cidade, o.uf) ?? o.local ?? null,
    };
  }

  const porCadastro = geocodeCidade(indice, o.cidade, o.uf);
  if (porCadastro) {
    return {
      tipo: "obra",
      obra: o,
      coord: { lat: porCadastro.lat, lng: porCadastro.lng },
      origem: "cidade",
      rotuloLocal: rotulo(porCadastro.nome, porCadastro.uf),
    };
  }

  const { cidade, uf } = parseCidadeUF(o.local);
  const porLocal = geocodeCidade(indice, cidade, uf);
  if (porLocal) {
    return {
      tipo: "obra",
      obra: o,
      coord: { lat: porLocal.lat, lng: porLocal.lng },
      origem: "local",
      rotuloLocal: rotulo(porLocal.nome, porLocal.uf),
    };
  }

  return {
    tipo: "obra",
    obra: o,
    coord: null,
    origem: null,
    rotuloLocal: rotulo(o.cidade ?? cidade, o.uf ?? normalizeUF(uf)) ?? o.local ?? null,
    motivoSemLocal: o.cidade?.trim() || o.local?.trim() ? "nao-reconhecida" : "sem-cadastro",
  };
}

export interface LogisticaPontos {
  colaboradores: PontoColaborador[];
  obras: PontoObra[];
  /** Ativos e sem coordenada — listados à parte para não sumirem da tela. */
  colaboradoresSemLocal: PontoColaborador[];
  obrasSemLocal: PontoObra[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
}

/**
 * Cruza colaboradores, obras e a base de municípios em pontos posicionáveis.
 *
 * Considera apenas colaboradores ativos e obras ativas — o mapa é ferramenta de
 * decisão sobre quem mobilizar agora, e desligados/encerradas só fariam ruído.
 * Overrides manuais de pin vêm de `useOverridesLogistica` e têm precedência
 * absoluta sobre qualquer geocodificação.
 */
export function useLogisticaPontos(): LogisticaPontos {
  const colaboradoresQuery = useColaboradores();
  const obrasQuery = useObras();
  const municipiosQuery = useMunicipios();
  const overrides = useOverridesLogistica();

  const indice = municipiosQuery.data;

  const { colaboradores, colaboradoresSemLocal } = useMemo(() => {
    if (!indice) return { colaboradores: [], colaboradoresSemLocal: [] };
    const pontos = (colaboradoresQuery.data ?? [])
      .filter((c) => c.ativo)
      .map((c) => localizarColaborador(c, indice, overrides));
    return {
      colaboradores: pontos.filter((p) => p.coord !== null),
      colaboradoresSemLocal: pontos.filter((p) => p.coord === null),
    };
  }, [colaboradoresQuery.data, indice, overrides]);

  const { obras, obrasSemLocal } = useMemo(() => {
    if (!indice) return { obras: [], obrasSemLocal: [] };
    const pontos = (obrasQuery.data ?? [])
      .filter((o) => o.ativa)
      .map((o) => localizarObra(o, indice, overrides));
    return {
      obras: pontos.filter((p) => p.coord !== null),
      obrasSemLocal: pontos.filter((p) => p.coord === null),
    };
  }, [obrasQuery.data, indice, overrides]);

  return {
    colaboradores,
    obras,
    colaboradoresSemLocal,
    obrasSemLocal,
    isLoading: colaboradoresQuery.isLoading || obrasQuery.isLoading || municipiosQuery.isLoading,
    isError: colaboradoresQuery.isError || obrasQuery.isError,
    error: colaboradoresQuery.error ?? obrasQuery.error,
    refetch: () => {
      void colaboradoresQuery.refetch();
      void obrasQuery.refetch();
      void municipiosQuery.refetch();
    },
  };
}

// Exportados para teste da precedência de coordenadas.
export const __internal = { localizarColaborador, localizarObra };
