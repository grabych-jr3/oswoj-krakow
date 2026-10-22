"use client";

import { Bus, ChevronDown, Footprints, LoaderCircle, MessageCircle, Share2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { TravelMode } from "@/contracts/geo";
import type { Place } from "@/contracts/place";
import { cn } from "@/lib/utils";
import type { NearbyState } from "@/map/useNearby";
import { NearbySummary } from "./NearbySummary";

const MODES: { mode: TravelMode; icon: typeof Footprints }[] = [
  { mode: "walk", icon: Footprints },
  { mode: "transit", icon: Bus },
];

/** "Kraków w 15 minut" panel (C4): the picked point, walk / transit switch, the summary and actions. */
export function NearbyPanel({
  state,
  onMode,
  onClose,
  onRetry,
  onPlace,
  onAsk,
  shareUrl,
  className,
}: {
  state: NearbyState;
  onMode: (mode: TravelMode) => void;
  onClose: () => void;
  onRetry: () => void;
  onPlace: (place: Place) => void;
  onAsk: () => void;
  shareUrl: () => string;
  className?: string;
}) {
  const t = useTranslations("Fifteen");
  const [copied, setCopied] = useState(false);
  // Phones show the index first; the list of places unfolds on demand so the map stays visible.
  const [expanded, setExpanded] = useState(false);
  const { origin, mode, status, result, error } = state;

  async function share() {
    const url = shareUrl();
    const text = t("shareText", { label: origin.label });
    try {
      // Phones get the system share sheet; elsewhere the link goes to the clipboard.
      if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ title: t("title"), text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Share sheet dismissed or clipboard blocked: nothing to report.
    }
  }

  return (
    <section
      id="nearby-panel"
      aria-labelledby="nearby-title"
      aria-busy={status === "loading"}
      className={cn("flex flex-col gap-3 rounded-2xl bg-card p-3.5 text-card-foreground shadow-float", className)}
    >
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 id="nearby-title" className="font-mono text-[11px] font-medium tracking-[0.04em] text-primary uppercase">
            {t("title")}
          </h2>
          <p className="text-[15px] leading-snug font-bold">{origin.label}</p>
          {origin.district && <p className="text-xs text-muted-foreground">{origin.district.name}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          title={t("close")}
          className="-mt-1 -mr-1 grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
        >
          <X className="size-4" aria-hidden />
        </button>
      </header>

      <div role="radiogroup" aria-label={t("modeLabel")} className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
        {MODES.map(({ mode: m, icon: Icon }) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => onMode(m)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-medium focus-visible:outline-2 focus-visible:outline-ring",
              mode === m ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground hover:bg-card",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {t(m)}
          </button>
        ))}
      </div>

      <div aria-live="polite" className="contents">
        {status === "loading" && (
          <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin text-primary" aria-hidden />
            {t("loading")}
          </p>
        )}
        {status === "error" && (
          <div role="alert" className="flex flex-col items-start gap-2 text-[13px]">
            <p>{error === "outside" ? t("outside") : t("error")}</p>
            {error !== "outside" && (
              <button
                type="button"
                onClick={onRetry}
                className="rounded-lg bg-primary px-3 py-1.5 font-semibold text-primary-foreground hover:bg-primary-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {t("retry")}
              </button>
            )}
          </div>
        )}
      </div>

      {status === "ready" && result && (
        <>
          <NearbySummary
            result={result}
            onPlace={onPlace}
            placesOpen
            detailsClassName={expanded ? "" : "max-md:hidden"}
            shortClassName={expanded ? "hidden" : "hidden max-md:block"}
          />
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
            className="flex items-center justify-center gap-1 rounded-lg py-1 text-[13px] font-medium text-primary-strong hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-ring md:hidden"
          >
            {expanded ? t("hidePlaces") : t("showPlaces")}
            <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} aria-hidden />
          </button>
          <div className="flex flex-wrap gap-1.5 border-t border-border pt-3">
            <button
              type="button"
              onClick={onAsk}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-[13px] font-semibold text-primary-foreground hover:bg-primary-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <MessageCircle className="size-4 shrink-0" aria-hidden />
              {t("ask")}
            </button>
            <button
              type="button"
              onClick={() => void share()}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary-soft px-3 py-2 text-[13px] font-semibold text-primary-strong hover:bg-[oklch(0.92_0.05_27)] focus-visible:outline-2 focus-visible:outline-ring"
            >
              <Share2 className="size-4 shrink-0" aria-hidden />
              <span aria-live="polite">{copied ? t("copied") : t("share")}</span>
            </button>
          </div>
        </>
      )}
    </section>
  );
}
