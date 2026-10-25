"use client";

import { useEffect, useMemo, useState } from "react";
import { Layer, Source, useMap } from "react-map-gl/maplibre";
import type { LngLatBoundsLike, PaddingOptions } from "maplibre-gl";
import { PlaceCategory } from "@/contracts/place";
import type { NearbyResult } from "@/contracts/geo";
import { type ChatMapView, spreadOffsets } from "@/map/chatMap";
import { addMarkerImages } from "@/map/markerImages";
import { zoneCovering } from "@/map/zone";

export const CHAT_MARKER_LAYER = "chat-markers";
export const CHAT_DOT_LAYER = "chat-dots";
export const CHAT_LAYER_IDS = [CHAT_MARKER_LAYER, CHAT_DOT_LAYER];

const BRAND = "#c90f1a";
const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
const MARKER_IMAGE = "chat-marker";
const TEXT_SIZE = 13;

/** The numbered marker: a brand circle with a white ring, drawn at 2× for sharp screens. */
function markerImage(): ImageData {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d")!;
  g.beginPath();
  g.arc(size / 2, size / 2, 27, 0, Math.PI * 2);
  g.fillStyle = BRAND;
  g.fill();
  g.lineWidth = 6;
  g.strokeStyle = "#fff";
  g.stroke();
  return g.getImageData(0, 0, size, size);
}

/**
 * What the assistant shows on the map (C3): numbered markers the answer refers to as "(1)",
 * category dots and the zone of a 15-minute answer, and its starting point. Fits the map once per answer.
 */
export function ChatLayers({ view, padding }: { view: ChatMapView | null; padding: () => PaddingOptions }) {
  const { current: map } = useMap();
  const [imageReady, setImageReady] = useState(false);

  // Marker images (numbered marker + category pins) must exist before the symbol layers draw;
  // add them again after a style reload.
  useEffect(() => {
    if (!map) return;
    const m = map.getMap();
    let live = true;
    const add = () => {
      if (!m.hasImage(MARKER_IMAGE)) m.addImage(MARKER_IMAGE, markerImage(), { pixelRatio: 2 });
      void addMarkerImages(m, PlaceCategory.options).then(() => live && setImageReady(true));
    };
    if (m.isStyleLoaded()) add();
    m.on("style.load", add);
    return () => {
      live = false;
      m.off("style.load", add);
    };
  }, [map]);

  const points = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!view) return EMPTY;
    // Places at the same address would cover each other: those markers stand side by side.
    const offsets = spreadOffsets(view.markers.filter((m) => m.label !== null).map((m) => m.place.coords));
    let n = 0;
    return {
      type: "FeatureCollection",
      features: view.markers.map((m) => {
        const dx = m.label !== null ? offsets[n++] : 0;
        return {
          type: "Feature",
          geometry: { type: "Point", coordinates: m.place.coords },
          properties: {
            key: m.key,
            label: m.label ?? "",
            category: m.place.category,
            numbered: m.label !== null,
            iconOffset: [dx, 0],
            textOffset: [dx / TEXT_SIZE, 0],
          },
        };
      }),
    };
  }, [view]);
  // The zone is drawn grown to cover every reachable place (see zoneCovering); until that is ready, as given.
  const reach = useMemo(() => (view?.area ? (view.reach ?? view.markers.map((m) => m.place.coords)) : []), [view]);
  const [covered, setCovered] = useState<{ key: string; area: NearbyResult["area"] } | null>(null);
  useEffect(() => {
    if (!view?.area) return;
    let live = true;
    const key = view.key;
    zoneCovering(view.area, reach)
      .then((grown) => live && setCovered({ key, area: grown }))
      .catch((e) => console.warn("[map] zone not extended", e));
    return () => {
      live = false;
    };
  }, [view, reach]);
  const zone = view?.area && covered?.key === view.key ? covered.area : (view?.area ?? null);
  const area = useMemo<GeoJSON.FeatureCollection>(
    () => (zone ? { type: "FeatureCollection", features: [zone as GeoJSON.Feature] } : EMPTY),
    [zone],
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
      ...(view.reach ?? []),
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
        {imageReady && (
          // Places of a 15-minute answer: the same category pins as the map layers, a bit smaller.
          <Layer
            id={CHAT_DOT_LAYER}
            type="symbol"
            filter={["!", ["get", "numbered"]]}
            layout={{
              "icon-image": ["concat", "pin-", ["get", "category"]],
              "icon-size": 0.85,
              "icon-allow-overlap": true,
            }}
          />
        )}
        {imageReady && (
          <Layer
            id={CHAT_MARKER_LAYER}
            type="symbol"
            filter={["get", "numbered"]}
            layout={{
              "icon-image": MARKER_IMAGE,
              "icon-offset": ["get", "iconOffset"] as unknown as [number, number],
              "icon-allow-overlap": true,
              "icon-ignore-placement": true,
              "text-field": ["get", "label"],
              "text-font": ["Noto Sans Bold"],
              "text-size": TEXT_SIZE,
              "text-offset": ["get", "textOffset"] as unknown as [number, number],
              "text-allow-overlap": true,
              "text-ignore-placement": true,
            }}
            paint={{ "text-color": "#fff" }}
          />
        )}
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
