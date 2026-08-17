/** @module-kind io */
/**
 * Roteamento rodoviário via OSRM.
 *
 * O serviço público (router.project-osrm.org) é gratuito e sem chave, mas não
 * tem SLA — por isso toda chamada tem fallback. Quem consome recebe uma rota
 * com `estimada: true` quando o traçado real não pôde ser obtido, e a UI marca
 * o número como aproximado em vez de esconder a informação.
 *
 * Apontar `VITE_OSRM_URL` para uma instância própria remove o limite de uso
 * sem nenhuma outra mudança de código.
 */
import { fetchWithRetry } from "@/lib/core/http/withRetry";
import { logger } from "@/lib/core/logger";
import { distanciaKm, duracaoEstimadaMin, type Coordenada } from "@/lib/logistica/haversine";

const OSRM_BASE =
  (import.meta.env?.VITE_OSRM_URL as string | undefined)?.replace(/\/+$/, "") ||
  "https://router.project-osrm.org";

/** GeoJSON `LineString` do traçado, no formato que o MapLibre consome. */
export interface GeometriaRota {
  type: "LineString";
  coordinates: [number, number][];
}

export interface Rota {
  distanciaKm: number;
  duracaoMin: number;
  geometry: GeometriaRota;
  /** `true` quando é linha reta + haversine, não o traçado real da estrada. */
  estimada: boolean;
}

/** Rota em linha reta — o fallback, e também o estado inicial durante o arrasto. */
export function rotaEmLinhaReta(origem: Coordenada, destino: Coordenada): Rota {
  const km = distanciaKm(origem, destino);
  return {
    distanciaKm: km,
    duracaoMin: duracaoEstimadaMin(km),
    geometry: {
      type: "LineString",
      coordinates: [
        [origem.lng, origem.lat],
        [destino.lng, destino.lat],
      ],
    },
    estimada: true,
  };
}

/**
 * Busca o traçado rodoviário entre dois pontos.
 *
 * Devolve `null` (e não lança) em qualquer falha — timeout, indisponibilidade,
 * resposta inesperada ou ausência de rota terrestre entre os pontos. Cabe a
 * quem chama cair em `rotaEmLinhaReta`.
 */
export async function rotaOsrm(origem: Coordenada, destino: Coordenada): Promise<Rota | null> {
  const coords = `${origem.lng},${origem.lat};${destino.lng},${destino.lat}`;
  const url = `${OSRM_BASE}/route/v1/driving/${coords}?overview=simplified&geometries=geojson`;

  try {
    const res = await fetchWithRetry(url, {}, { timeoutMs: 8000, maxAttempts: 2, label: "osrm" });
    if (!res.ok) return null;

    const dados = await res.json();
    if (dados?.code !== "Ok" || !Array.isArray(dados?.routes) || dados.routes.length === 0) {
      return null;
    }

    const rota = dados.routes[0];
    const coordenadas = rota?.geometry?.coordinates;
    if (!Array.isArray(coordenadas) || coordenadas.length < 2) return null;
    if (!Number.isFinite(rota.distance) || !Number.isFinite(rota.duration)) return null;

    return {
      distanciaKm: rota.distance / 1000,
      duracaoMin: Math.round(rota.duration / 60),
      geometry: { type: "LineString", coordinates: coordenadas as [number, number][] },
      estimada: false,
    };
  } catch (err) {
    logger.warn("osrm: rota indisponível, usando estimativa em linha reta", { err });
    return null;
  }
}

/** Rota real quando possível, estimativa em linha reta quando não. Nunca falha. */
export async function rotaComFallback(origem: Coordenada, destino: Coordenada): Promise<Rota> {
  return (await rotaOsrm(origem, destino)) ?? rotaEmLinhaReta(origem, destino);
}
