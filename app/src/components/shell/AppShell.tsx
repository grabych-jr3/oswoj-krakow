"use client";

import { Layers } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { MapProvider, type MapLayerMouseEvent } from "react-map-gl/maplibre";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { BaseMap, MapAttribution, ZoomControls } from "@/components/map/BaseMap";
import { LayerPanel } from "@/components/map/LayerPanel";
import { handlePlaceClick, PLACE_LAYER_IDS, PlaceLayers } from "@/components/map/PlaceLayers";
import { useMapLayers } from "@/map/useMapLayers";
import { AddressSearch, TopBar } from "@/components/shell/TopBar";
import { WELCOME_SEEN_KEY, WelcomeDialog } from "@/components/shell/WelcomeDialog";

/**
 * Page layout (C1). Desktop: map + red chat column on the right (design variant A).
 * Mobile: full-screen map with a bottom-sheet chat; map overlays sit above the sheet.
 */
export function AppShell({ initialQuestion }: { initialQuestion?: string }) {
  const t = useTranslations("Header");
  const tMap = useTranslations("Map");
  // A question from the home page opens the chat straight away (also on mobile).
  const [chatExpanded, setChatExpanded] = useState(Boolean(initialQuestion));
  // Show the welcome dialog once per browser. The dialog markup does not depend on this
  // state (it opens via showModal in an effect), so reading storage here is hydration-safe.
  const [welcomeOpen, setWelcomeOpen] = useState(() => {
    // Someone arriving with a question already knows the service: don't block it with the dialog.
    if (typeof window === "undefined" || initialQuestion) return false;
    try {
      return !localStorage.getItem(WELCOME_SEEN_KEY);
    } catch {
      return true;
    }
  });
  const [sheetHeight, setSheetHeight] = useState(0);
  const chatRef = useRef<HTMLElement>(null);
  const tLayers = useTranslations("Layers");
  const layers = useMapLayers();
  const [layersOpen, setLayersOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? (layers.byId.get(selectedId) ?? null) : null;

  function onMapClick(e: MapLayerMouseEvent) {
    // undefined = cluster zoom (keep selection); null = empty map (close the popup)
    void handlePlaceClick(e).then((id) => {
      if (id !== undefined) setSelectedId(id);
    });
  }

  // On mobile the chat is a fixed sheet: keep the map attribution just above it.
  useEffect(() => {
    const el = chatRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const fixed = getComputedStyle(el).position === "fixed";
      setSheetHeight(fixed ? el.getBoundingClientRect().height : 0);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function closeWelcome() {
    setWelcomeOpen(false);
    try {
      localStorage.setItem(WELCOME_SEEN_KEY, "1");
    } catch {
      // Private mode: the dialog simply shows again next time.
    }
  }

  return (
    <MapProvider>
      <h1 className="sr-only">{t("pageTitle")}</h1>
      <div className="flex h-dvh overflow-hidden">
        <section aria-label={tMap("label")} className="relative min-w-0 flex-1 overflow-hidden bg-map">
          <BaseMap interactiveLayerIds={PLACE_LAYER_IDS} onClick={onMapClick}>
            <PlaceLayers places={layers.places} selected={selected} onClose={() => setSelectedId(null)} />
          </BaseMap>

          <div className="absolute inset-x-3 top-3 z-10 flex flex-col gap-2.5 md:inset-x-auto md:top-4 md:left-4 md:w-[min(400px,calc(100%-32px))]">
            <TopBar onAbout={() => setWelcomeOpen(true)} />
            <AddressSearch />
            <ZoomControls className="hidden self-start md:flex" />
            {/* Phones: layers open from a round button so the panel does not cover the map */}
            <button
              type="button"
              onClick={() => setLayersOpen((o) => !o)}
              aria-expanded={layersOpen}
              aria-controls="layers-mobile-panel"
              aria-label={tLayers("title")}
              className={`grid size-11 place-items-center self-end rounded-full shadow-float focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:hidden ${layersOpen ? "bg-primary text-primary-foreground" : "bg-card text-primary"}`}
            >
              <Layers className="size-5" aria-hidden />
            </button>
            <LayerPanel
              index={layers.index}
              error={layers.error}
              enabled={layers.enabled}
              loading={layers.loading}
              onToggle={layers.toggle}
              onSetAll={layers.setAll}
              idPrefix="layers-mobile"
              className={`max-h-[50dvh] overflow-y-auto md:hidden ${layersOpen ? "" : "hidden"}`}
            />
          </div>

          {/* Desktop: the layer list stays open in the top-right corner of the map */}
          <div className="absolute top-4 right-4 z-10 hidden w-72 md:block">
            <LayerPanel
              index={layers.index}
              error={layers.error}
              enabled={layers.enabled}
              loading={layers.loading}
              onToggle={layers.toggle}
              onSetAll={layers.setAll}
              idPrefix="layers-desktop"
              className="max-h-[calc(100dvh-32px)] overflow-y-auto"
            />
          </div>

          {/* On mobile it sits just above the chat sheet; hidden while the sheet covers the map. */}
          <MapAttribution
            className={`absolute left-3 z-10 max-w-[calc(100%-24px)] md:bottom-2 md:left-4 ${chatExpanded ? "max-md:hidden" : ""}`}
            style={{ bottom: sheetHeight ? sheetHeight + 8 : undefined }}
          />
        </section>

        <ChatPanel
          ref={chatRef}
          expanded={chatExpanded}
          onExpandedChange={setChatExpanded}
          initialQuestion={initialQuestion}
        />
      </div>
      <WelcomeDialog open={welcomeOpen} onClose={closeWelcome} />
    </MapProvider>
  );
}
