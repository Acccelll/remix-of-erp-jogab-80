import React from "react";
import { Layer, Source } from "@vis.gl/react-maplibre";
import type { GeometriaRota } from "@/lib/logistica/osrm";

export interface CamadaRotasProps {
  /** Traçado confirmado (rota real do OSRM ou linha reta estimada). */
  rota: GeometriaRota | null;
  /** Se o traçado é estimado — desenhado tracejado para não passar por exato. */
  estimada?: boolean;
  /** Linha-guia presa ao cursor durante o arrasto. */
  guia: GeometriaRota | null;
}

const GEOJSON_VAZIO = { type: "FeatureCollection" as const, features: [] };

const paraFeature = (geometry: GeometriaRota) => ({
  type: "FeatureCollection" as const,
  features: [{ type: "Feature" as const, properties: {}, geometry }],
});

/**
 * Camadas de rota do mapa.
 *
 * Duas fontes separadas de propósito: a guia muda a cada movimento do mouse e
 * a rota não, então mantê-las independentes evita reprocessar o traçado real a
 * cada frame do arrasto.
 *
 * As cores são literais porque MapLibre pinta em WebGL e não resolve
 * `hsl(var(--token))`; os valores espelham `--primary` e `--warning` do tema.
 */
const CamadaRotas: React.FC<CamadaRotasProps> = ({ rota, estimada, guia }) => (
  <>
    <Source id="logistica-rota" type="geojson" data={rota ? paraFeature(rota) : GEOJSON_VAZIO}>
      <Layer
        id="logistica-rota-linha"
        type="line"
        layout={{ "line-cap": "round", "line-join": "round" }}
        paint={{
          "line-color": estimada ? "#d97706" : "#1d4ed8",
          "line-width": 3,
          "line-opacity": 0.85,
          ...(estimada ? { "line-dasharray": [2, 1.5] as [number, number] } : {}),
        }}
      />
    </Source>

    <Source id="logistica-guia" type="geojson" data={guia ? paraFeature(guia) : GEOJSON_VAZIO}>
      <Layer
        id="logistica-guia-linha"
        type="line"
        layout={{ "line-cap": "round" }}
        paint={{
          "line-color": "#1d4ed8",
          "line-width": 2,
          "line-opacity": 0.6,
          "line-dasharray": [1.5, 1.5],
        }}
      />
    </Source>
  </>
);

export default CamadaRotas;
