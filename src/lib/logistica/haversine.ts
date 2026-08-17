/** @module-kind pure */
/**
 * Distância geodésica entre dois pontos.
 *
 * Serve a dois propósitos na logística: ordenar candidatos por proximidade
 * (onde o custo de uma chamada de roteamento por par seria proibitivo) e
 * servir de fallback quando o OSRM não responde. É sempre um piso — a
 * distância por estrada nunca é menor que a linha reta.
 */

export interface Coordenada {
  lat: number;
  lng: number;
}

const RAIO_TERRA_KM = 6371;

const rad = (graus: number) => (graus * Math.PI) / 180;

/** Distância em quilômetros entre dois pontos, em linha reta sobre a esfera. */
export function distanciaKm(a: Coordenada, b: Coordenada): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const senoLat = Math.sin(dLat / 2);
  const senoLng = Math.sin(dLng / 2);
  const h = senoLat * senoLat + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * senoLng * senoLng;
  return 2 * RAIO_TERRA_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Estimativa grosseira de tempo de viagem para o fallback sem OSRM.
 *
 * Usa 1,3× a linha reta (fator de sinuosidade típico da malha brasileira) a
 * uma média de 70 km/h. É explicitamente uma aproximação: a UI marca esses
 * números como estimados quando a rota real não pôde ser calculada.
 */
export function duracaoEstimadaMin(distanciaEmLinhaRetaKm: number): number {
  const kmRodovia = distanciaEmLinhaRetaKm * 1.3;
  return Math.round((kmRodovia / 70) * 60);
}

/** Ponto médio, usado para enquadrar o mapa em uma rota. */
export function pontoMedio(a: Coordenada, b: Coordenada): Coordenada {
  return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
}
