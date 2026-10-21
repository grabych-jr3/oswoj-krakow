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
  // Phones start with the map clear; desktop has room for the open panel.
  const [layersOpen, setLayersOpen] = useState(false);
  const [desktopLayersOpen, setDesktopLayersOpen] = useState(true);
  const layersBtnRef = useRef<HTMLButtonElement>(null);
  const desktopLayersBtnRef = useRef<HTMLButtonElement>(null);
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

  // The collapse button disappears with the panel: hand focus back to the round layers button.
  function collapseLayers(desktop: boolean) {
    if (desktop) setDesktopLayersOpen(false);
    else setLayersOpen(false);
    requestAnimationFrame(() => (desktop ? desktopLayersBtnRef : layersBtnRef).current?.focus());
  }

  const layerPanelProps = {
    index: layers.index,
    error: layers.error,
    enabled: layers.enabled,
    loading: layers.loading,
    onToggle: layers.toggle,
    onSetAll: layers.setAll,
  };
  const roundBtn = (on: boolean) =>
    `grid size-11 shrink-0 place-items-center self-end rounded-full shadow-float focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${on ? "bg-primary text-primary-foreground" : "bg-card text-primary"}`;

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

          {/* Overlay column. On phones it ends just above the chat sheet, so an open layer panel
              scrolls inside the free space instead of sliding under the chat. */}
          <div
            style={{ "--sheet-h": `${sheetHeight}px` } as React.CSSProperties}
            className="pointer-events-none absolute inset-x-3 top-3 bottom-[calc(var(--sheet-h)+12px)] z-10 flex flex-col gap-2.5 *:pointer-events-auto md:inset-x-auto md:top-4 md:bottom-auto md:left-4 md:w-[min(400px,calc(100%-32px))]"
          >
            <TopBar onAbout={() => setWelcomeOpen(true)} />
            <AddressSearch />
            <ZoomControls className="hidden self-start md:flex" />
            {/* Phones: layers open from a round button so the panel does not cover the map */}
            <button
              ref={layersBtnRef}
              type="button"
              onClick={() => setLayersOpen((o) => !o)}
              aria-expanded={layersOpen}
              aria-controls="layers-mobile-panel"
              aria-label={tLayers("title")}
              className={`${roundBtn(layersOpen)} md:hidden`}
            >
              <Layers className="size-5" aria-hidden />
            </button>
            <LayerPanel
              {...layerPanelProps}
              idPrefix="layers-mobile"
              onClose={() => collapseLayers(false)}
              className={`min-h-0 overflow-y-auto md:hidden ${layersOpen ? "" : "hidden"}`}
            />
          </div>

          {/* Desktop: the layer panel in the top-right corner, collapsible to a round button */}
          <div className="absolute top-4 right-4 z-10 hidden md:block">
            <button
              ref={desktopLayersBtnRef}
              type="button"
              onClick={() => setDesktopLayersOpen(true)}
              aria-expanded={desktopLayersOpen}
              aria-controls="layers-desktop-panel"
              aria-label={tLayers("title")}
              title={tLayers("title")}
              className={`${roundBtn(false)} ${desktopLayersOpen ? "hidden" : ""}`}
            >
              <Layers className="size-5" aria-hidden />
            </button>
            <LayerPanel
              {...layerPanelProps}
              idPrefix="layers-desktop"
              onClose={() => collapseLayers(true)}
              className={`max-h-[calc(100dvh-32px)] w-72 overflow-y-auto ${desktopLayersOpen ? "" : "hidden"}`}
            />
          </div>

          {/* On mobile it sits just above the chat sheet; hidden while the sheet or the layer panel covers that spot. */}
          <MapAttribution
            className={`absolute left-3 z-10 max-w-[calc(100%-24px)] md:bottom-2 md:left-4 ${chatExpanded || layersOpen ? "max-md:hidden" : ""}`}
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
