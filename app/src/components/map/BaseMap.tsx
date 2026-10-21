"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MapLibreMap } from "maplibre-gl";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Map as MapGL, type MapLayerMouseEvent, useMap } from "react-map-gl/maplibre";

export const MAP_ID = "main";

// OpenFreeMap: free vector tiles, no API key (PLAN.md §4.2).
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

// The worker is served from /public (copied by scripts/copy-maplibre-worker.mjs) because the
// bundler cannot resolve MapLibre's dynamic worker URL. Loaded only in the browser.
const mapLib =
  typeof window === "undefined"
    ? undefined
    : import("maplibre-gl").then((m) => {
        m.setWorkerUrl("/maplibre-gl-worker.mjs");
        return m;
      });

// Kraków, Rynek Główny.
const INITIAL_VIEW = { longitude: 19.9373, latitude: 50.0614, zoom: 12.3 };

// Recolour the neutral basemap into the warm palette of the design mock.
function applyBrandTint(map: MapLibreMap) {
  for (const layer of map.getStyle().layers ?? []) {
    const id = layer.id.toLowerCase();
    try {
      if (layer.type === "background") {
        map.setPaintProperty(layer.id, "background-color", "#f3efea");
      } else if (layer.type === "fill" && id.includes("water")) {
        map.setPaintProperty(layer.id, "fill-color", "#c9dce6");
      } else if (layer.type === "line" && id.includes("water")) {
        map.setPaintProperty(layer.id, "line-color", "#c3d6e1");
      } else if (layer.type === "fill" && /park|grass|wood|forest|landcover|cemetery/.test(id)) {
        map.setPaintProperty(layer.id, "fill-color", "#dce7d1");
      }
    } catch {
      // Layers differ between style versions; a failed tint must never break the map.
    }
  }
}

type BaseMapProps = {
  children?: React.ReactNode;
  interactiveLayerIds?: string[];
  onClick?: (e: MapLayerMouseEvent) => void;
  /** The MapLibre instance once loaded, for code outside the map tree (chat requests, camera moves). */
  onMapLoad?: (map: MapLibreMap) => void;
};

export function BaseMap({ children, interactiveLayerIds, onClick, onMapLoad }: BaseMapProps) {
  const [cursor, setCursor] = useState<string>();
  return (
    <MapGL
      id={MAP_ID}
      mapLib={mapLib}
      initialViewState={INITIAL_VIEW}
      mapStyle={STYLE_URL}
      attributionControl={false}
      dragRotate={false}
      style={{ position: "absolute", inset: 0 }}
      onLoad={(e) => {
        applyBrandTint(e.target);
        onMapLoad?.(e.target);
        // Test hook for browser checks; only in builds made with NEXT_PUBLIC_EXPOSE_MAP=1.
        if (process.env.NEXT_PUBLIC_EXPOSE_MAP === "1") (window as unknown as { __map: unknown }).__map = e.target;
      }}
      interactiveLayerIds={interactiveLayerIds}
      onClick={onClick}
      cursor={cursor}
      onMouseEnter={() => setCursor("pointer")}
      onMouseLeave={() => setCursor(undefined)}
    >
      {children}
    </MapGL>
  );
}

export function ZoomControls({ className }: { className?: string }) {
  const t = useTranslations("Map");
  const { [MAP_ID]: map } = useMap();
  const btn =
    "grid size-10 place-items-center bg-card text-xl text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring";
  return (
    <div className={`flex flex-col overflow-hidden rounded-xl bg-card shadow-float ${className ?? ""}`}>
      <button type="button" className={btn} aria-label={t("zoomIn")} onClick={() => map?.zoomIn()}>
        +
      </button>
      <span className="h-px bg-border" aria-hidden />
      <button type="button" className={btn} aria-label={t("zoomOut")} onClick={() => map?.zoomOut()}>
        −
      </button>
    </div>
  );
}

/** Compact attribution: a small "©" button that unfolds the credits required by the OSM licence. */
export function MapAttribution({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const t = useTranslations("Map");
  const [open, setOpen] = useState(false);
  const link = "underline-offset-2 hover:underline";
  return (
    <div style={style} className={`flex items-end gap-1 ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="map-attribution"
        aria-label={t("attribution")}
        title={t("attribution")}
        className="grid size-6 shrink-0 place-items-center rounded-full bg-white/85 font-mono text-[11px] font-semibold text-[oklch(0.38_0.02_27)] shadow-sm hover:bg-white focus-visible:outline-2 focus-visible:outline-ring"
      >
        ©
      </button>
      <p
        id="map-attribution"
        hidden={!open}
        className="rounded-md bg-white/90 px-1.5 py-0.5 font-mono text-[10px] leading-4 text-[oklch(0.38_0.02_27)]"
      >
        <a className={link} href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          © OpenStreetMap
        </a>{" "}
        ·{" "}
        <a className={link} href="https://openfreemap.org" target="_blank" rel="noreferrer">
          OpenFreeMap
        </a>{" "}
        · {t("sources")}
      </p>
    </div>
  );
}
