// Logística — rota rodoviária entre colaborador e obra, com cache por par.
import { useQuery } from "@tanstack/react-query";
import { queryKey } from "@/lib/query-keys";
import { rotaComFallback, type Rota } from "@/lib/logistica/osrm";
import type { Coordenada } from "@/lib/logistica/haversine";

/** Arredonda a chave de cache: 4 casas (~11 m) evita recalcular por ruído. */
const chaveCoord = (c: Coordenada) => `${c.lat.toFixed(4)},${c.lng.toFixed(4)}`;

export const rotaKeys = {
  par: (origem: Coordenada, destino: Coordenada) =>
    queryKey("logistica-rota", chaveCoord(origem), chaveCoord(destino)),
};

/**
 * Rota entre dois pontos, cacheada indefinidamente.
 *
 * A geografia não muda durante a sessão, então `staleTime: Infinity` evita
 * repetir chamadas ao OSRM público quando o usuário volta a um par já visto.
 * Nunca fica em erro: `rotaComFallback` sempre resolve, com `estimada: true`
 * quando o traçado real não veio.
 */
export function useRotaOsrm(origem: Coordenada | null, destino: Coordenada | null) {
  return useQuery<Rota>({
    queryKey:
      origem && destino ? rotaKeys.par(origem, destino) : queryKey("logistica-rota", "vazio"),
    queryFn: () => rotaComFallback(origem as Coordenada, destino as Coordenada),
    enabled: !!origem && !!destino,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    retry: false,
  });
}
