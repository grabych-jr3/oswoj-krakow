"use client";

import { Layers } from "lucide-react";
import type { Map as MapLibreMap, PaddingOptions } from "maplibre-gl";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapProvider, type MapLayerMouseEvent, Popup } from "react-map-gl/maplibre";
import { type ChatActions, ChatActionsContext } from "@/components/chat/ChatActions";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { useAssistant } from "@/components/chat/useAssistant";
import { AddressSearch } from "@/components/fifteen/AddressSearch";
import { NearbyPanel } from "@/components/fifteen/NearbyPanel";
import { BaseMap, MapAttribution, ZoomControls } from "@/components/map/BaseMap";
import { CHAT_LAYER_IDS, ChatLayers } from "@/components/map/ChatLayers";
import { DistrictPopup } from "@/components/map/DistrictPopup";
import { LayerPanel } from "@/components/map/LayerPanel";
import { DISTRICT_LAYER, DistrictLayers, INDEX_LAYER, IndexLayer } from "@/components/map/OverlayLayers";
import { handlePlaceClick, PLACE_LAYER_IDS, PlaceLayers } from "@/components/map/PlaceLayers";
import { PlacePopup } from "@/components/map/PlacePopup";
import { TopBar } from "@/components/shell/TopBar";
import { WelcomeDialog } from "@/components/shell/WelcomeDialog";
import type { LngLat } from "@/contracts/common";
import type { GeocodeResult, TravelMode } from "@/contracts/geo";
import type { DistrictStats, Place } from "@/contracts/place";
import { type ChatMapView, deriveChatMap } from "@/map/chatMap";
import { nearbyLink } from "@/map/nearby";
import { rememberWelcomeSeen } from "@/lib/welcome";
import { useMapLayers } from "@/map/useMapLayers";
import { useOverlays } from "@/map/useOverlays";
import { pointOrigin, useNearby } from "@/map/useNearby";

const INTERACTIVE_LAYERS = [...CHAT_LAYER_IDS, ...PLACE_LAYER_IDS, INDEX_LAYER, DISTRICT_LAYER];
const isDesktop = () => window.matchMedia("(min-width: 768px)").matches;
// Height of the top bar + address field on phones, which cover the top of the map.
const PHONE_TOP_PX = 140;
// Rough height of the place card above the chat sheet on phones.
const PHONE_CARD_PX = 260;
// Width of the left overlay column on desktop (top bar, address, 15-minute panel).
const DESKTOP_COLUMN_PX = 420;

/** A 15-minute view to open on load, from a shared link (`/mapa?lng=…&lat=…&mode=…`). */
export type InitialNearby = { coords: LngLat; mode: TravelMode };

/**
 * Page layout. Desktop: map + red chat column on the right (design variant A).
 * Mobile: full-screen map with a bottom-sheet chat; map overlays sit above the sheet.
 * C3: the chat and the map talk through ChatActions (chat → map) and the place popup (map → chat).
 * C4: "Kraków w 15 minut" — address search or a point on the map, walk / transit, zone and summary.
 */
export function AppShell({
  initialQuestion,
  initialNearby,
  welcomeSeen = true,
}: {
  initialQuestion?: string;
  initialNearby?: InitialNearby;
  /** From the cookie on the server: first-time visitors get the welcome dialog. */
  welcomeSeen?: boolean;
}) {
  const t = useTranslations("Header");
  const tMap = useTranslations("Map");
  const tChat = useTranslations("Chat");
  const tFifteen = useTranslations("Fifteen");
  const locale = useLocale();
  // A question from the home page opens the chat straight away (also on mobile).
  const [chatExpanded, setChatExpanded] = useState(Boolean(initialQuestion));
  // Welcome dialog once per browser. Someone arriving with a question or a shared link already
  // knows the service: don't block it.
  const [welcomeOpen, setWelcomeOpen] = useState(!welcomeSeen && !initialQuestion && !initialNearby);
  // The map library is the heaviest part of the page; behind the first-visit dialog it is of no use,
  // so it starts loading when the dialog closes (at once for everyone else).
  const [mapWanted, setMapWanted] = useState(!welcomeOpen);
  const [sheetHeight, setSheetHeight] = useState(0);
  const chatRef = useRef<HTMLElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const tLayers = useTranslations("Layers");
  const layers = useMapLayers();
  const overlays = useOverlays();
  const [district, setDistrict] = useState<{
    stats: DistrictStats;
    at: [number, number];
  } | null>(null);
  // Phones start with the map clear; desktop has room for the open panel.
  const [layersOpen, setLayersOpen] = useState(false);
  const [desktopLayersOpen, setDesktopLayersOpen] = useState(true);
  const layersBtnRef = useRef<HTMLButtonElement>(null);
  const desktopLayersBtnRef = useRef<HTMLButtonElement>(null);
  const [selected, setSelected] = useState<Place | null>(null);

  // --- Kraków w 15 minut (C4) -----------------------------------------------------------
  const nearby = useNearby();
  const [picking, setPicking] = useState(false);
  // Phones: the 15-minute panel is a bottom sheet in place of the chat; asking about the area brings the chat back.
  const [chatOverNearby, setChatOverNearby] = useState(false);

  // --- Chat ------------------------------------------------------------------------------
  // The chat request reads the map view and the picked point at send time, so it lives in a ref.
  const mapContext = useRef<GeocodeResult | null>(null);
  const getMap = useCallback(() => {
    const map = mapRef.current;
    if (!map) return undefined;
    const c = map.getCenter();
    return {
      center: [c.lng, c.lat] as [number, number],
      zoom: map.getZoom(),
      origin: mapContext.current,
    };
  }, []);
  const assistant = useAssistant({ getMap, initialQuestion });
  const chatView = useMemo(() => deriveChatMap(assistant.messages), [assistant.messages]);

  // The 15-minute panel shows until the chat draws something newer on the map.
  const nearbyState = nearby.state && nearby.state.tag === (chatView?.key ?? "") ? nearby.state : null;
  const nearbyResult = nearbyState?.status === "ready" ? nearbyState.result : null;

  useEffect(() => {
    mapContext.current = nearbyState?.status === "ready" ? nearbyState.origin : null;
  }, [nearbyState]);

  // Keep the address in the URL, so a reload or a shared link opens the same view.
  const nearbyCoords = nearbyState?.origin.coords;
  const nearbyMode = nearbyState?.mode;
  useEffect(() => {
    const url = new URL(window.location.href);
    if (nearbyCoords && nearbyMode) {
      const next = nearbyLink(url.href, nearbyCoords, nearbyMode);
      if (next !== url.href) window.history.replaceState(window.history.state, "", next);
    } else if (url.searchParams.has("lng")) {
      for (const k of ["lng", "lat", "mode"]) url.searchParams.delete(k);
      window.history.replaceState(window.history.state, "", url.href);
    }
  }, [nearbyCoords, nearbyMode]);

  const chatKey = chatView?.key ?? "";
  const { run: runNearby } = nearby;
  const lastMode = nearby.state?.mode ?? "walk";
  const openNearby = useCallback(
    (origin: GeocodeResult, mode?: TravelMode) => {
      runNearby(origin, mode ?? lastMode, chatKey);
      setChatOverNearby(false);
      setSelected(null);
      setPicking(false);
      if (!isDesktop()) {
        setLayersOpen(false);
        setChatExpanded(false);
      }
    },
    [runNearby, lastMode, chatKey],
  );

  // A shared link opens its 15-minute view once the page is there.
  const openedInitial = useRef(false);
  useEffect(() => {
    if (!initialNearby || openedInitial.current) return;
    openedInitial.current = true;
    runNearby(pointOrigin(initialNearby.coords), initialNearby.mode, "");
  }, [initialNearby, runNearby]);

  // Escape leaves the "pick a point" mode, then closes a place or district card.
  const escapable = picking || !!selected || !!district;
  useEffect(() => {
    if (!escapable) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || document.querySelector("dialog:modal")) return;
      if (picking) setPicking(false);
      else {
        setSelected(null);
        setDistrict(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [escapable, picking]);

  /** What the map draws on top of the layers: the 15-minute zone, or the latest chat answer. */
  const mapView = useMemo<ChatMapView | null>(() => {
    if (!nearbyState) return chatView;
    const { origin, mode, result } = nearbyState;
    const key = `nearby:${origin.coords.join(",")}:${mode}`;
    // The reachable places show as regular pins (below), so the overlay has only the zone and the start.
    return result
      ? {
          key,
          markers: [],
          area: result.area,
          origin: { label: origin.label, coords: origin.coords },
        }
      : {
          key: `${key}:loading`,
          markers: [],
          area: null,
          origin: { label: origin.label, coords: origin.coords },
          fit: false,
        };
  }, [nearbyState, chatView]);

  // While a zone is shown, the layers show only the places within reach (still per enabled layer).
  const shownPlaces = useMemo(() => {
    if (!nearbyResult) return layers.places;
    return nearbyResult.places.filter((p) => layers.enabled.size === 0 || layers.enabled.has(p.category));
  }, [nearbyResult, layers.places, layers.enabled]);
  const placeById = useCallback(
    (id: string) => layers.byId.get(id) ?? nearbyResult?.places.find((p) => p.id === id) ?? null,
    [layers.byId, nearbyResult],
  );

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
  const nearbyOpen = !!nearbyState;
  const mapPadding = useCallback((): PaddingOptions => {
    if (isDesktop()) {
      return {
        top: 90,
        bottom: 60,
        left: nearbyOpen ? DESKTOP_COLUMN_PX + 30 : 60,
        right: desktopLayersOpen ? 330 : 80,
      };
    }
    // Phones: fit the zone into the strip above the bottom sheet (the 15-minute panel or the chat).
    const panel = document.getElementById("nearby-panel")?.getBoundingClientRect().height ?? 0;
    return {
      top: PHONE_TOP_PX + 10,
      bottom: sheetHeight + (panel ? panel + 20 : 30),
      left: 30,
      right: 30,
    };
  }, [desktopLayersOpen, sheetHeight, nearbyOpen]);

  /** Select a place and bring it into the part of the map that is not covered by panels. */
  const focusPlace = useCallback(
    (place: Place, { move }: { move: boolean }) => {
      setSelected(place);
      const map = mapRef.current;
      if (!map) return;
      if (isDesktop()) {
        if (move)
          map.easeTo({
            center: place.coords,
            zoom: Math.max(map.getZoom(), 15),
            duration: 600,
          });
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
      showNearby: (origin, mode) => openNearby({ ...origin, district: null, precision: "address" }, mode),
    }),
    [ask, focusPlace, showOnly, openNearby],
  );

  function onMapClick(e: MapLayerMouseEvent) {
    if (picking) {
      openNearby(pointOrigin([e.lngLat.lng, e.lngLat.lat]));
      return;
    }
    const features = e.features ?? [];
    const feature = features[0];
    if (feature && CHAT_LAYER_IDS.includes(feature.layer.id)) {
      const marker = mapView?.markers.find((m) => m.key === feature.properties?.key);
      if (marker) focusPlace(marker.place, { move: false });
      return;
    }
    setDistrict(null);
    // Below the places: a hexagon of the city-wide index opens "15 minut" there; else a district's statistics.
    if (!feature || !PLACE_LAYER_IDS.includes(feature.layer.id)) {
      const at: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      if (features.some((f) => f.layer.id === INDEX_LAYER)) {
        openNearby(pointOrigin(at));
        return;
      }
      const hit = features.find((f) => f.layer.id === DISTRICT_LAYER);
      // Feature properties come back flattened, so the statistics are taken from the loaded layer.
      const stats = hit && overlays.districts.data?.features.find((d) => d.properties.number === hit.properties?.number)?.properties;
      if (stats) {
        setSelected(null);
        setDistrict({ stats, at });
        // Desktop: the statistics popup is tall; bring the point up so it opens fully on screen.
        if (isDesktop()) {
          const map = mapRef.current;
          const y = map?.project(at).y ?? 0;
          if (map && y > map.getContainer().clientHeight * 0.4)
            map.easeTo({
              center: at,
              offset: [0, -map.getContainer().clientHeight * 0.25],
              duration: 450,
            });
        }
        return;
      }
    }
    // undefined = cluster zoom (keep selection); null = empty map (close the popup)
    void handlePlaceClick(e).then((id) => {
      if (id === undefined) return;
      const place = id ? placeById(id) : null;
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

  function closeNearby() {
    nearby.clear();
    requestAnimationFrame(() => document.getElementById("address-search")?.focus());
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

  const nearbyPanel = nearbyState && (
    <NearbyPanel
      state={nearbyState}
      onMode={nearby.setMode}
      onClose={closeNearby}
      onRetry={nearby.retry}
      onPlace={(p) => focusPlace(p, { move: true })}
      onAsk={() => {
        ask(tFifteen("question", { label: nearbyState.origin.label }));
        setChatOverNearby(true);
        setChatExpanded(true);
      }}
      shareUrl={() => nearbyLink(`${window.location.origin}/${locale}/mapa`, nearbyState.origin.coords, nearbyState.mode)}
      // Desktop: under the address field. Phones: a bottom sheet, out of the way while the layer list,
      // a place card or the chat is open.
      className={`min-h-0 shrink ${selected || district || layersOpen || chatOverNearby ? "max-md:hidden" : ""}`}
    />
  );

  function closeWelcome() {
    setWelcomeOpen(false);
    setMapWanted(true);
    rememberWelcomeSeen();
  }

  return (
    <MapProvider>
      <ChatActionsContext.Provider value={actions}>
        <h1 className="sr-only">{t("pageTitle")}</h1>
        {/* Keyboard users can skip the map controls straight to the question field. */}
        <a
          href="#chat-input"
          className="sr-only z-50 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-float focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {t("skipToChat")}
        </a>
        <div className="flex h-dvh overflow-hidden">
          <section aria-label={tMap("label")} className="relative min-w-0 flex-1 overflow-hidden bg-map">
            {mapWanted && (
              <BaseMap
                interactiveLayerIds={INTERACTIVE_LAYERS}
                onClick={onMapClick}
                onMapLoad={(m) => (mapRef.current = m)}
                picking={picking}
              >
                {overlays.indexOn && overlays.index.data && <IndexLayer data={overlays.index.data} mode={overlays.indexMode} />}
                {overlays.districtsOn && overlays.districts.data && <DistrictLayers data={overlays.districts.data} />}
                {district && (
                  <Popup
                    longitude={district.at[0]}
                    latitude={district.at[1]}
                    onClose={() => setDistrict(null)}
                    closeButton={false}
                    closeOnClick={false}
                    maxWidth="320px"
                    className="place-popup"
                  >
                    <DistrictPopup district={district.stats} onClose={() => setDistrict(null)} />
                  </Popup>
                )}
                <PlaceLayers places={shownPlaces} selected={selected} onClose={() => setSelected(null)} onAsk={askAbout} />
                <ChatLayers view={mapView} padding={mapPadding} />
              </BaseMap>
            )}

            {/* Overlay column. On phones it ends just above the chat sheet, so an open layer panel
                scrolls inside the free space instead of sliding under the chat. */}
            <div
              style={{ "--sheet-h": `${sheetHeight}px` } as React.CSSProperties}
              className="pointer-events-none absolute inset-x-3 top-3 bottom-[calc(var(--sheet-h)+12px)] z-10 flex flex-col gap-2.5 *:pointer-events-auto md:inset-x-auto md:top-4 md:bottom-4 md:left-4 md:w-[min(400px,calc(100%-32px))]"
            >
              <TopBar onAbout={() => setWelcomeOpen(true)} />
              <AddressSearch
                value={nearbyState?.origin.label}
                onSelect={(r) => openNearby(r)}
                picking={picking}
                onTogglePick={() => setPicking((p) => !p)}
              />
              {nearbyPanel}
              <ZoomControls className="hidden shrink-0 self-start md:flex" />
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
                overlays={overlays}
                onClose={() => collapseLayers(false)}
                className={`min-h-0 overflow-y-auto motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2 md:hidden ${layersOpen ? "" : "hidden"}`}
              />
              {/* Phones: the selected place as a card above the chat sheet (a map popup would fall off-screen). */}
              {district && !selected && (
                <div className="mt-auto min-h-0 overflow-y-auto rounded-2xl bg-card p-3.5 shadow-float motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 md:hidden">
                  <DistrictPopup district={district.stats} onClose={() => setDistrict(null)} className="w-full" />
                </div>
              )}
              {selected && (
                <div className="mt-auto min-h-0 overflow-y-auto rounded-2xl bg-card p-3.5 shadow-float motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 md:hidden">
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
                overlays={overlays}
                onClose={() => collapseLayers(true)}
                className={`max-h-[calc(100dvh-32px)] w-72 overflow-y-auto ${desktopLayersOpen ? "" : "hidden"}`}
              />
            </div>

            {/* On mobile it sits just above the chat sheet; hidden while a sheet, panel or card covers that spot. */}
            <MapAttribution
              className={`absolute left-3 z-10 max-w-[calc(100%-24px)] md:bottom-2 md:left-4 ${chatExpanded || layersOpen || selected || district || nearbyState ? "max-md:hidden" : ""}`}
              style={{ bottom: sheetHeight ? sheetHeight + 8 : undefined }}
            />
          </section>

          <ChatPanel
            ref={chatRef}
            assistant={assistant}
            expanded={chatExpanded}
            onExpandedChange={setChatExpanded}
            phoneHidden={!!nearbyState && !chatOverNearby}
          />
        </div>
        <WelcomeDialog open={welcomeOpen} onClose={closeWelcome} />
      </ChatActionsContext.Provider>
    </MapProvider>
  );
}
