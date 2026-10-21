"use client";

import { Layers } from "lucide-react";
import type { Map as MapLibreMap, PaddingOptions } from "maplibre-gl";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapProvider, type MapLayerMouseEvent } from "react-map-gl/maplibre";
import { type ChatActions, ChatActionsContext } from "@/components/chat/ChatActions";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { useAssistant } from "@/components/chat/useAssistant";
import { BaseMap, MapAttribution, ZoomControls } from "@/components/map/BaseMap";
import { CHAT_LAYER_IDS, ChatLayers } from "@/components/map/ChatLayers";
import { LayerPanel } from "@/components/map/LayerPanel";
import { handlePlaceClick, PLACE_LAYER_IDS, PlaceLayers } from "@/components/map/PlaceLayers";
import { PlacePopup } from "@/components/map/PlacePopup";
import { AddressSearch, TopBar } from "@/components/shell/TopBar";
import { WELCOME_SEEN_KEY, WelcomeDialog } from "@/components/shell/WelcomeDialog";
import type { Place } from "@/contracts/place";
import { deriveChatMap } from "@/map/chatMap";
import { useMapLayers } from "@/map/useMapLayers";

const INTERACTIVE_LAYERS = [...CHAT_LAYER_IDS, ...PLACE_LAYER_IDS];
const isDesktop = () => window.matchMedia("(min-width: 768px)").matches;
// Height of the top bar + address field on phones, which cover the top of the map.
const PHONE_TOP_PX = 140;
// Rough height of the place card above the chat sheet on phones.
const PHONE_CARD_PX = 260;

/**
 * Page layout. Desktop: map + red chat column on the right (design variant A).
 * Mobile: full-screen map with a bottom-sheet chat; map overlays sit above the sheet.
 * C3: the chat and the map talk through ChatActions (chat → map) and the place popup (map → chat).
 */
export function AppShell({ initialQuestion }: { initialQuestion?: string }) {
  const t = useTranslations("Header");
  const tMap = useTranslations("Map");
  const tChat = useTranslations("Chat");
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
  const mapRef = useRef<MapLibreMap | null>(null);
  const tLayers = useTranslations("Layers");
  const layers = useMapLayers();
  // Phones start with the map clear; desktop has room for the open panel.
  const [layersOpen, setLayersOpen] = useState(false);
  const [desktopLayersOpen, setDesktopLayersOpen] = useState(true);
  const layersBtnRef = useRef<HTMLButtonElement>(null);
  const desktopLayersBtnRef = useRef<HTMLButtonElement>(null);
  const [selected, setSelected] = useState<Place | null>(null);

  // --- Chat ------------------------------------------------------------------------------
  const getMap = useCallback(() => {
    const map = mapRef.current;
    if (!map) return undefined;
    const c = map.getCenter();
    // The address picked for "Kraków w 15 minut" arrives with C4.
    return { center: [c.lng, c.lat] as [number, number], zoom: map.getZoom(), origin: null };
  }, []);
  const assistant = useAssistant({ getMap, initialQuestion });
  const chatView = useMemo(() => deriveChatMap(assistant.messages), [assistant.messages]);

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

  /** Map padding that keeps fitted places clear of the overlays. */
  const mapPadding = useCallback((): PaddingOptions => {
    if (isDesktop()) return { top: 90, bottom: 60, left: 60, right: desktopLayersOpen ? 330 : 80 };
    return { top: PHONE_TOP_PX + 10, bottom: sheetHeight + 30, left: 40, right: 40 };
  }, [desktopLayersOpen, sheetHeight]);

  /** Select a place and bring it into the part of the map that is not covered by panels. */
  const focusPlace = useCallback(
    (place: Place, { move }: { move: boolean }) => {
      setSelected(place);
      const map = mapRef.current;
      if (!map) return;
      if (isDesktop()) {
        if (move) map.easeTo({ center: place.coords, zoom: Math.max(map.getZoom(), 15), duration: 600 });
        return;
      }
      // Phones: the card sits above the chat sheet, so aim the place at the middle of the free strip.
      setLayersOpen(false);
      setChatExpanded(false);
      const h = map.getContainer().clientHeight;
      const freeBottom = h - sheetHeight - PHONE_CARD_PX;
      const y = map.project(place.coords).y;
      if (move || y < PHONE_TOP_PX || y > freeBottom) {
        map.easeTo({
          center: place.coords,
          zoom: move ? Math.max(map.getZoom(), 15) : map.getZoom(),
          offset: [0, (PHONE_TOP_PX + freeBottom) / 2 - h / 2],
          duration: 600,
        });
      }
    },
    [sheetHeight],
  );

  const { ask } = assistant;
  const askAbout = useCallback(
    (place: Place) => {
      ask(tChat("askAboutPlace", { name: place.name, address: place.address }));
      setChatExpanded(true);
    },
    [ask, tChat],
  );

  const { showOnly } = layers;
  const actions = useMemo<ChatActions>(
    () => ({
      ask: (text) => {
        ask(text);
        setChatExpanded(true);
      },
      showPlace: (place) => focusPlace(place, { move: true }),
      showCategories: (categories) => {
        showOnly(categories);
        if (!isDesktop()) {
          setChatExpanded(false);
          setLayersOpen(true);
        }
      },
    }),
    [ask, focusPlace, showOnly],
  );

  function onMapClick(e: MapLayerMouseEvent) {
    const feature = e.features?.[0];
    if (feature && CHAT_LAYER_IDS.includes(feature.layer.id)) {
      const marker = chatView?.markers.find((m) => m.key === feature.properties?.key);
      if (marker) focusPlace(marker.place, { move: false });
      return;
    }
    // undefined = cluster zoom (keep selection); null = empty map (close the popup)
    void handlePlaceClick(e).then((id) => {
      if (id === undefined) return;
      const place = id ? layers.byId.get(id) : null;
      if (place) focusPlace(place, { move: false });
      else setSelected(null);
    });
  }

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
      <ChatActionsContext.Provider value={actions}>
        <h1 className="sr-only">{t("pageTitle")}</h1>
        <div className="flex h-dvh overflow-hidden">
          <section aria-label={tMap("label")} className="relative min-w-0 flex-1 overflow-hidden bg-map">
            <BaseMap interactiveLayerIds={INTERACTIVE_LAYERS} onClick={onMapClick} onMapLoad={(m) => (mapRef.current = m)}>
              <PlaceLayers places={layers.places} selected={selected} onClose={() => setSelected(null)} onAsk={askAbout} />
              <ChatLayers view={chatView} padding={mapPadding} />
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
              {/* Phones: the selected place as a card above the chat sheet (a map popup would fall off-screen). */}
              {selected && (
                <div className="mt-auto min-h-0 overflow-y-auto rounded-2xl bg-card p-3.5 shadow-float md:hidden">
                  <PlacePopup place={selected} onClose={() => setSelected(null)} onAsk={askAbout} className="w-full" />
                </div>
              )}
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

            {/* On mobile it sits just above the chat sheet; hidden while the sheet, the layer panel or the place card covers that spot. */}
            <MapAttribution
              className={`absolute left-3 z-10 max-w-[calc(100%-24px)] md:bottom-2 md:left-4 ${chatExpanded || layersOpen || selected ? "max-md:hidden" : ""}`}
              style={{ bottom: sheetHeight ? sheetHeight + 8 : undefined }}
            />
          </section>

          <ChatPanel ref={chatRef} assistant={assistant} expanded={chatExpanded} onExpandedChange={setChatExpanded} />
        </div>
        <WelcomeDialog open={welcomeOpen} onClose={closeWelcome} />
      </ChatActionsContext.Provider>
    </MapProvider>
  );
}
