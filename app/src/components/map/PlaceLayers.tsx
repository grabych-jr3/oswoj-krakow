"use client";

import type { GeoJSONSource } from "maplibre-gl";
import { useEffect, useMemo, useState } from "react";
import { Layer, type MapLayerMouseEvent, Popup, Source, useMap } from "react-map-gl/maplibre";
import { PlaceCategory, type Place } from "@/contracts/place";
import { CATEGORY_STYLES } from "@/lib/categories";
import { addMarkerImages } from "@/map/markerImages";
import { toFeatureCollection } from "@/map/places";
import { PlacePopup } from "./PlacePopup";

const SOURCE_ID = "places";
// Lowest layer of the chat overlay (ChatLayers); map pins stay below it.
const CHAT_BOTTOM_LAYER = "chat-area-fill";
export const CLUSTER_LAYER = "places-clusters";
export const POINT_LAYER = "places-points";
export const PLACE_LAYER_IDS = [CLUSTER_LAYER, POINT_LAYER];

// Hex: MapLibre paint properties do not accept oklch() colours.
const BRAND = "#c90f1a";

/** Clustered markers of the enabled categories + popup of the selected place (PLAN.md §6.C, C2). */
export function PlaceLayers({
  places,
  selected,
  onClose,
  onAsk,
}: {
  places: Place[];
  selected: Place | null;
  onClose: () => void;
  onAsk?: (place: Place) => void;
}) {
  const { current: map } = useMap();
  const [imagesReady, setImagesReady] = useState(false);
  const data = useMemo(() => toFeatureCollection(places), [places]);

  // Marker images must exist before the symbol layer renders; re-add them if the style reloads.
  useEffect(() => {
    if (!map) return;
    const m = map.getMap();
    let cancelled = false;
    const register = () =>
      addMarkerImages(m, PlaceCategory.options).then(() => {
        if (!cancelled) setImagesReady(true);
      });
    if (m.isStyleLoaded()) register();
    m.on("style.load", register);
    return () => {
      cancelled = true;
      m.off("style.load", register);
    };
  }, [map]);

  return (
    <>
      <Source id={SOURCE_ID} type="geojson" data={data} cluster clusterRadius={44} clusterMaxZoom={14}>
        <Layer
          id={CLUSTER_LAYER}
          type="circle"
          filter={["has", "point_count"]}
          paint={{
            "circle-color": BRAND,
            "circle-opacity": 0.92,
            "circle-radius": ["step", ["get", "point_count"], 16, 25, 20, 100, 26],
            "circle-stroke-color": "#fff",
            "circle-stroke-width": 3,
          }}
        />
        <Layer
          id="places-cluster-count"
          type="symbol"
          filter={["has", "point_count"]}
          layout={{
            "text-field": ["get", "point_count_abbreviated"],
            "text-font": ["Noto Sans Bold"],
            "text-size": 13,
            "text-allow-overlap": true,
          }}
          paint={{ "text-color": "#fff" }}
        />
        <Layer
          id="places-selected"
          type="circle"
          filter={["==", ["get", "id"], selected?.id ?? ""]}
          paint={{
            "circle-radius": 24,
            "circle-color": selected ? CATEGORY_STYLES[selected.category].color : BRAND,
            "circle-opacity": 0.25,
          }}
        />
        {imagesReady && (
          <Layer
            id={POINT_LAYER}
            // Pins arrive after their images: keep them under the assistant's numbered markers.
            beforeId={map?.getMap().getLayer(CHAT_BOTTOM_LAYER) ? CHAT_BOTTOM_LAYER : undefined}
            type="symbol"
            filter={["!", ["has", "point_count"]]}
            layout={{
              "icon-image": ["concat", "pin-", ["get", "category"]],
              "icon-allow-overlap": true,
              "icon-size": ["case", ["==", ["get", "id"], selected?.id ?? ""], 1.2, 1],
            }}
          />
        )}
      </Source>

      {selected && (
        <Popup
          longitude={selected.coords[0]}
          latitude={selected.coords[1]}
          onClose={onClose}
          closeButton={false}
          closeOnClick={false}
          offset={22}
          maxWidth="320px"
          // Hidden on phones (globals.css): they show the place in a card above the chat sheet (AppShell).
          className="place-popup"
        >
          <PlacePopup place={selected} onClose={onClose} onAsk={onAsk} />
        </Popup>
      )}
    </>
  );
}

/** Map click: zoom into a cluster, select a place, or clear the selection. Returns the place id or null. */
export async function handlePlaceClick(e: MapLayerMouseEvent): Promise<string | null | undefined> {
  const feature = e.features?.[0];
  if (!feature) return null;
  if (feature.layer.id === CLUSTER_LAYER) {
    const source = e.target.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    const clusterId = feature.properties?.cluster_id as number | undefined;
    if (source && clusterId !== undefined) {
      const zoom = await source.getClusterExpansionZoom(clusterId);
      const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates;
      e.target.easeTo({ center: [lng, lat], zoom: zoom + 0.3, duration: 450 });
    }
    return undefined; // keep the current selection
  }
  return (feature.properties?.id as string | undefined) ?? null;
}
