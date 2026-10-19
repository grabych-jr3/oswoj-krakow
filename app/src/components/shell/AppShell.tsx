"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { MapProvider } from "react-map-gl/maplibre";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { BaseMap, MapAttribution, ZoomControls } from "@/components/map/BaseMap";
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
          <BaseMap />

          <div className="absolute inset-x-3 top-3 z-10 flex flex-col gap-2.5 md:inset-x-auto md:top-4 md:left-4 md:w-[min(400px,calc(100%-32px))]">
            <TopBar onAbout={() => setWelcomeOpen(true)} />
            <AddressSearch />
            <ZoomControls className="hidden self-start md:flex" />
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
