"use client";

import { useTranslations } from "next-intl";
import { ChatPanel } from "@/components/chat/ChatPanel";
import type { Assistant } from "@/components/chat/useAssistant";
import { AddressSearch } from "@/components/fifteen/AddressSearch";
import { TopBar } from "@/components/shell/TopBar";
import { WELCOME_DIALOG_CLASS, WelcomeBody } from "@/components/shell/WelcomeDialog";
import { WELCOME_SEEN_KEY } from "@/lib/welcome";

const noop = () => {};
const idleAssistant: Assistant = {
  messages: [],
  status: "ready",
  error: undefined,
  busy: false,
  rateLimited: false,
  ask: noop,
  stop: async () => {},
  reset: noop,
  retry: noop,
};

// Runs while the HTML is parsed, before the first paint: first-time visitors (no cookie, no link with a
// question or a point) see the welcome dialog at once instead of after the scripts have loaded.
const SHOW_WELCOME = `(function(){try{var s=location.search;if(/(^|; )${WELCOME_SEEN_KEY}=1/.test(document.cookie)||/[?&](q|lng)=/.test(s))return;var d=document.getElementById("welcome-early");if(d)d.setAttribute("open","")}catch(e){}})();`;

/**
 * Static shell of the map page, shown while the request-dependent part streams in: the same top bar,
 * address field and chat sheet, without the map (a map mounted here and replaced a moment later would
 * abort MapLibre mid-start). On slow phones the page reads at once instead of after the scripts.
 */
export function AppShellSkeleton() {
  const t = useTranslations("Header");
  const tMap = useTranslations("Map");
  return (
    <>
      <h1 className="sr-only">{t("pageTitle")}</h1>
      <div className="flex h-dvh overflow-hidden">
        <section aria-label={tMap("label")} className="relative min-w-0 flex-1 overflow-hidden bg-map">
          <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex flex-col gap-2.5 *:pointer-events-auto md:inset-x-auto md:top-4 md:left-4 md:w-[min(400px,calc(100%-32px))]">
            <TopBar onAbout={noop} />
            <AddressSearch onSelect={noop} picking={false} onTogglePick={noop} />
          </div>
        </section>
        <ChatPanel assistant={idleAssistant} expanded={false} onExpandedChange={noop} />
      </div>
      <dialog id="welcome-early" aria-labelledby="welcome-title" className={WELCOME_DIALOG_CLASS} suppressHydrationWarning>
        <WelcomeBody />
      </dialog>
      <script dangerouslySetInnerHTML={{ __html: SHOW_WELCOME }} />
    </>
  );
}
