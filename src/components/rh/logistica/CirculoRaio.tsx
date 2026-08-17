import React, { useMemo } from "react";
import { Layer, Source } from "@vis.gl/react-maplibre";
import type { Coordenada } from "@/lib/logistica/haversine";

export interface CirculoRaioProps {
  centro: Coordenada | null;
  raioKm: number;
}

/**
 * Polígono geodésico aproximando um círculo de `raioKm` ao redor de `centro`.
 * 64 vértices — suave o bastante para não parecer octógono no zoom padrão do
 * país, barato o bastante para recalcular a cada mudança de raio/obra.
 */
function circuloGeoJSON(centro: Coordenada, raioKm: number) {
  const pontos: [number, number][] = [];
  const passos = 64;
  const R = 6371; // raio da Terra em km
  const latRad = (centro.lat * Math.PI) / 180;
  const d = raioKm / R;

  for (let i = 0; i <= passos; i++) {
    const brng = (i / passos) * 2 * Math.PI;
    const lat = Math.asin(
      Math.sin(latRad) * Math.cos(d) + Math.cos(latRad) * Math.sin(d) * Math.cos(brng),
    );
    const lng =
      (centro.lng * Math.PI) / 180 +
      Math.atan2(
        Math.sin(brng) * Math.sin(d) * Math.cos(latRad),
        Math.cos(d) - Math.sin(latRad) * Math.sin(lat),
      );
    pontos.push([(lng * 180) / Math.PI, (lat * 180) / Math.PI]);
  }

  return {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        properties: {},
        geometry: { type: "Polygon" as const, coordinates: [pontos] },
      },
    ],
  };
}

const VAZIO = { type: "FeatureCollection" as const, features: [] };

/**
 * Círculo de "raio aceitável de deslocamento" ao redor da obra selecionada.
 * Preenchimento translúcido + linha pontilhada, coerente com a paleta de rota.
 */
const CirculoRaio: React.FC<CirculoRaioProps> = ({ centro, raioKm }) => {
  const data = useMemo(
    () => (centro && raioKm > 0 ? circuloGeoJSON(centro, raioKm) : VAZIO),
    [centro, raioKm],
  );

  return (
    <Source id="logistica-raio" type="geojson" data={data}>
      <Layer
        id="logistica-raio-preenchimento"
        type="fill"
        paint={{ "fill-color": "#1d4ed8", "fill-opacity": 0.06 }}
      />
      <Layer
        id="logistica-raio-borda"
        type="line"
        paint={{
          "line-color": "#1d4ed8",
          "line-width": 1.5,
          "line-opacity": 0.5,
          "line-dasharray": [2, 2],
        }}
      />
    </Source>
  );
};

export default CirculoRaio;
