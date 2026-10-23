"use client";

import { Layer, Source, useMap } from "react-map-gl/maplibre";
import type { TravelMode } from "@/contracts/geo";
import type { AccessIndex, DistrictLayer } from "@/map/overlays";

export const INDEX_LAYER = "access-index-fill";
export const DISTRICT_LAYER = "districts-fill";

/** Index 0–100 in steps of 1/6 → colour, from "almost nothing within 15 minutes" to "all six groups". */
export const INDEX_COLORS: [number, string][] = [
  [0, "#9f1239"],
  [17, "#d9472b"],
  [33, "#ee8a3c"],
  [50, "#f4c25b"],
  [67, "#c3cf63"],
  [83, "#7eb356"],
  [100, "#2f8a4c"],
];

/** The first label layer of the base map: overlays go below it, so street names stay readable. */
function useFirstLabelLayer(): string | undefined {
  const { current: map } = useMap();
  try {
    return map?.getMap().getStyle()?.layers.find((l) => l.type === "symbol")?.id;
  } catch {
    return undefined;
  }
}

/** City-wide "Indeks 15 minut" (S1, C5): every hexagon coloured by its index for the chosen mode. */
export function IndexLayer({ data, mode }: { data: AccessIndex; mode: TravelMode }) {
  const beforeId = useFirstLabelLayer();
  const color = ["step", ["get", mode], INDEX_COLORS[0][1], ...INDEX_COLORS.slice(1).flatMap(([v, c]) => [v, c])];
  return (
    <Source id="access-index" type="geojson" data={data.cells}>
      <Layer
        id={INDEX_LAYER}
        type="fill"
        beforeId={beforeId}
        paint={{ "fill-color": color as unknown as string, "fill-opacity": 0.5, "fill-outline-color": "rgba(255,255,255,0.35)" }}
      />
    </Source>
  );
}

/** District borders with names (A4); the invisible fill makes a district clickable for its statistics. */
export function DistrictLayers({ data }: { data: DistrictLayer }) {
  const beforeId = useFirstLabelLayer();
  return (
    <Source id="districts" type="geojson" data={data}>
      <Layer id={DISTRICT_LAYER} type="fill" beforeId={beforeId} paint={{ "fill-color": "#c90f1a", "fill-opacity": 0 }} />
      <Layer
        id="districts-line"
        type="line"
        beforeId={beforeId}
        paint={{ "line-color": "#7a0d16", "line-width": 1.6, "line-opacity": 0.75, "line-dasharray": [3, 2] }}
      />
      <Layer
        id="districts-label"
        type="symbol"
        layout={{
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Bold"],
          "text-size": 12,
          "text-transform": "uppercase",
          "text-letter-spacing": 0.05,
          "text-max-width": 8,
        }}
        paint={{ "text-color": "#7a0d16", "text-halo-color": "#ffffff", "text-halo-width": 1.6 }}
      />
    </Source>
  );
}
