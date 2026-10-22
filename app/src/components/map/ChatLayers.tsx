"use client";

import { useEffect, useMemo } from "react";
import { Layer, Source, useMap } from "react-map-gl/maplibre";
import type { LngLatBoundsLike, PaddingOptions } from "maplibre-gl";
import { PlaceCategory } from "@/contracts/place";
import { CATEGORY_STYLES } from "@/lib/categories";
import type { ChatMapView } from "@/map/chatMap";

export const CHAT_MARKER_LAYER = "chat-markers";
export const CHAT_DOT_LAYER = "chat-dots";
export const CHAT_LAYER_IDS = [CHAT_MARKER_LAYER, CHAT_DOT_LAYER];

const BRAND = "#c90f1a";
const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

// ["match", category, "zlobek", "#…", …, fallback] — MapLibre paint needs plain hex colours.
const CATEGORY_COLOR = [
  "match",
  ["get", "category"],
  ...PlaceCategory.options.flatMap((c) => [c, CATEGORY_STYLES[c].color]),
  BRAND,
] as unknown as string;

/**
 * What the assistant shows on the map (C3): numbered markers the answer refers to as "(1)",
 * category dots and the zone of a 15-minute answer, and its starting point. Fits the map once per answer.
 */
export function ChatLayers({ view, padding }: { view: ChatMapView | null; padding: () => PaddingOptions }) {
  const { current: map } = useMap();

  const points = useMemo<GeoJSON.FeatureCollection>(
    () =>
      view
        ? {
            type: "FeatureCollection",
            features: view.markers.map((m) => ({
              type: "Feature",
              geometry: { type: "Point", coordinates: m.place.coords },
              properties: { key: m.key, label: m.label ?? "", category: m.place.category, numbered: m.label !== null },
            })),
          }
        : EMPTY,
    [view],
  );
  const area = useMemo<GeoJSON.FeatureCollection>(
    () => (view?.area ? { type: "FeatureCollection", features: [view.area as GeoJSON.Feature] } : EMPTY),
    [view],
  );
  const origin = useMemo<GeoJSON.FeatureCollection>(
    () =>
      view?.origin
        ? { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: view.origin.coords }, properties: {} }] }
        : EMPTY,
    [view],
  );

  // Fit the map to each new answer once; later re-renders of the same answer leave the map alone.
  const viewKey = view?.key;
  useEffect(() => {
    if (!map || !view || view.fit === false) return;
    const coords = [
      ...view.markers.map((m) => m.place.coords),
      ...(view.origin ? [view.origin.coords] : []),
      ...(view.area ? flatCoords(view.area.geometry.coordinates) : []),
    ];
    if (!coords.length) return;
    const lngs = coords.map((c) => c[0]);
    const lats = coords.map((c) => c[1]);
    const bounds: LngLatBoundsLike = [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
    map.fitBounds(bounds, { padding: padding(), maxZoom: 15.5, duration: 700 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per answer (viewKey), not per render
  }, [map, viewKey]);

  return (
    <>
      <Source id="chat-area" type="geojson" data={area}>
        <Layer id="chat-area-fill" type="fill" paint={{ "fill-color": BRAND, "fill-opacity": 0.08 }} />
        <Layer id="chat-area-line" type="line" paint={{ "line-color": BRAND, "line-width": 2, "line-dasharray": [2, 1.5] }} />
      </Source>
      <Source id="chat-places" type="geojson" data={points}>
        <Layer
          id={CHAT_DOT_LAYER}
          type="circle"
          filter={["!", ["get", "numbered"]]}
          paint={{ "circle-radius": 7, "circle-color": CATEGORY_COLOR, "circle-stroke-color": "#fff", "circle-stroke-width": 2 }}
        />
        <Layer
          id={CHAT_MARKER_LAYER}
          type="circle"
          filter={["get", "numbered"]}
          paint={{ "circle-radius": 14, "circle-color": BRAND, "circle-stroke-color": "#fff", "circle-stroke-width": 3 }}
        />
        <Layer
          id="chat-marker-labels"
          type="symbol"
          filter={["get", "numbered"]}
          layout={{ "text-field": ["get", "label"], "text-font": ["Noto Sans Bold"], "text-size": 13, "text-allow-overlap": true, "text-ignore-placement": true }}
          paint={{ "text-color": "#fff" }}
        />
      </Source>
      <Source id="chat-origin" type="geojson" data={origin}>
        <Layer id="chat-origin-halo" type="circle" paint={{ "circle-radius": 16, "circle-color": BRAND, "circle-opacity": 0.2 }} />
        <Layer id="chat-origin" type="circle" paint={{ "circle-radius": 8, "circle-color": BRAND, "circle-stroke-color": "#fff", "circle-stroke-width": 3 }} />
      </Source>
    </>
  );
}

/** All [lng, lat] pairs of a Polygon / MultiPolygon coordinate array. */
function flatCoords(coords: unknown): [number, number][] {
  if (!Array.isArray(coords)) return [];
  if (coords.length >= 2 && typeof coords[0] === "number" && typeof coords[1] === "number") return [[coords[0], coords[1]]];
  return coords.flatMap(flatCoords);
}
