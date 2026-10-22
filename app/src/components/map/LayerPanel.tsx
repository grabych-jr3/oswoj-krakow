"use client";

import { Hexagon, Layers, LoaderCircle, Map as MapIcon, X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { PlaceCategory } from "@/contracts/place";
import { CATEGORY_STYLES } from "@/lib/categories";
import { cn } from "@/lib/utils";
import type { LayerInfo } from "@/map/places";
import type { Overlays } from "@/map/useOverlays";
import { INDEX_COLORS } from "./OverlayLayers";

type Props = {
  index: LayerInfo[] | null;
  error: boolean;
  enabled: Set<PlaceCategory>;
  loading: Set<PlaceCategory>;
  onToggle: (c: PlaceCategory) => void;
  onSetAll: (on: boolean) => void;
  className?: string;
  /** Keeps element ids unique when the panel is rendered twice (phone + desktop). */
  idPrefix?: string;
  /** Collapses the panel back to the round layers button. */
  onClose?: () => void;
  /** City overlays (C5): the "Indeks 15 minut" heat map and districts. */
  overlays?: Overlays;
};

/** List of map layers with counts and switches (C2). */
export function LayerPanel({ index, error, enabled, loading, onToggle, onSetAll, className, idPrefix = "layers", onClose, overlays }: Props) {
  const t = useTranslations("Layers");
  const tCat = useTranslations("Categories");
  const allOn = !!index && index.every((c) => enabled.has(c.category));

  return (
    <section id={`${idPrefix}-panel`} aria-labelledby={`${idPrefix}-title`} className={cn("flex flex-col gap-2 rounded-2xl bg-card p-3 shadow-float", className)}>
      <div className="flex items-center justify-between gap-2 px-1">
        <h2 id={`${idPrefix}-title`} className="flex items-center gap-1.5 text-sm font-bold">
          <Layers className="size-4 text-primary" aria-hidden />
          {t("title")}
        </h2>
        <div className="flex items-center gap-1">
          {index && (
            <button
              type="button"
              onClick={() => onSetAll(!allOn)}
              className="rounded-md px-1.5 py-0.5 text-xs font-medium text-primary-strong hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-ring"
            >
              {allOn ? t("hideAll") : t("showAll")}
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label={t("collapse")}
              title={t("collapse")}
              className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
        </div>
      </div>

      {error && <p className="px-1 text-xs text-muted-foreground">{t("error")}</p>}
      {!index && !error && <p className="px-1 text-xs text-muted-foreground">{t("loading")}</p>}

      {index && (
        <ul className="flex flex-col">
          {index.map(({ category, count }) => {
            const { color, icon: Icon } = CATEGORY_STYLES[category];
            const on = enabled.has(category);
            const id = `${idPrefix}-${category}`;
            return (
              <li key={category}>
                <label
                  htmlFor={id}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1 py-1.5 hover:bg-muted has-focus-visible:outline-2 has-focus-visible:outline-ring"
                >
                  <span
                    className={cn("grid size-7 shrink-0 place-items-center rounded-full text-white transition-opacity", !on && "opacity-35")}
                    style={{ background: color }}
                    aria-hidden
                  >
                    <Icon className="size-3.5" />
                  </span>
                  <span className={cn("min-w-0 flex-1 truncate text-[13px]", !on && "text-muted-foreground")}>{tCat(category)}</span>
                  {loading.has(category) ? (
                    <LoaderCircle className="size-3.5 animate-spin text-muted-foreground" aria-label={t("loading")} />
                  ) : (
                    <span className="font-mono text-[11px] text-muted-foreground">{count}</span>
                  )}
                  {/* Switch: native checkbox for keyboard and screen readers, styled as a toggle */}
                  <input id={id} type="checkbox" checked={on} onChange={() => onToggle(category)} className="peer sr-only" />
                  <span
                    aria-hidden
                    className={cn(
                      "relative h-5 w-9 shrink-0 rounded-full transition-colors",
                      on ? "bg-primary" : "bg-[oklch(0.86_0.01_27)]",
                    )}
                  >
                    <span className={cn("absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform", on ? "translate-x-[18px]" : "translate-x-0.5")} />
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {overlays && <OverlaySwitches overlays={overlays} idPrefix={idPrefix} />}
    </section>
  );
}

/** A labelled on/off switch: a native checkbox for keyboards and screen readers, drawn as a toggle. */
function Switch({ id, on, onChange }: { id: string; on: boolean; onChange: () => void }) {
  return (
    <>
      <input id={id} type="checkbox" checked={on} onChange={onChange} className="peer sr-only" />
      <span aria-hidden className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", on ? "bg-primary" : "bg-[oklch(0.86_0.01_27)]")}>
        <span className={cn("absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform", on ? "translate-x-[18px]" : "translate-x-0.5")} />
      </span>
    </>
  );
}

function OverlaySwitches({ overlays, idPrefix }: { overlays: Overlays; idPrefix: string }) {
  const t = useTranslations("Layers");
  const tFifteen = useTranslations("Fifteen");
  const { indexOn, indexMode, setIndexMode, index, toggleIndex, districtsOn, districts, toggleDistricts } = overlays;
  const row =
    "flex cursor-pointer items-center gap-2.5 rounded-lg px-1 py-1.5 hover:bg-muted has-focus-visible:outline-2 has-focus-visible:outline-ring";
  const chip = "grid size-7 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-strong";
  const status = (s: { status: string }) =>
    s.status === "loading" ? (
      <LoaderCircle className="size-3.5 animate-spin text-muted-foreground" aria-label={t("loading")} />
    ) : null;

  return (
    <div className="flex flex-col border-t border-border pt-2">
      <h3 className="px-1 pb-1 text-[11px] font-semibold tracking-[0.04em] text-muted-foreground uppercase">{t("analysis")}</h3>

      <label htmlFor={`${idPrefix}-overlay-index`} className={row}>
        <span className={chip} aria-hidden>
          <Hexagon className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1 text-[13px]">{t("indexLayer")}</span>
        {status(index)}
        <Switch id={`${idPrefix}-overlay-index`} on={indexOn} onChange={toggleIndex} />
      </label>
      {indexOn && index.status === "error" && <p className="px-1 text-xs text-primary-strong">{t("overlayError")}</p>}
      {indexOn && index.status !== "error" && (
        <div className="flex flex-col gap-2 px-1 pt-1 pb-2">
          <div role="radiogroup" aria-label={tFifteen("modeLabel")} className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-0.5">
            {(["walk", "transit"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={indexMode === m}
                onClick={() => setIndexMode(m)}
                className={cn(
                  "rounded-md px-2 py-1 text-xs font-medium focus-visible:outline-2 focus-visible:outline-ring",
                  indexMode === m ? "bg-primary text-primary-foreground" : "hover:bg-card",
                )}
              >
                {tFifteen(m)}
              </button>
            ))}
          </div>
          {/* Legend: one swatch per index step (0, 17 … 100 = 0 … 6 groups within reach). */}
          <div>
            <div className="flex h-2.5 overflow-hidden rounded-full" aria-hidden>
              {INDEX_COLORS.map(([v, c]) => (
                <span key={v} className="flex-1" style={{ background: c, opacity: 0.8 }} />
              ))}
            </div>
            <p className="mt-0.5 flex justify-between text-[11px] text-muted-foreground">
              <span>0 – {t("legendLow")}</span>
              <span>100 – {t("legendHigh")}</span>
            </p>
          </div>
          <p className="text-[11px] leading-snug text-muted-foreground">{t("indexHint")}</p>
        </div>
      )}

      <label htmlFor={`${idPrefix}-overlay-districts`} className={row}>
        <span className={chip} aria-hidden>
          <MapIcon className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1 text-[13px]">{t("districtsLayer")}</span>
        {status(districts)}
        <Switch id={`${idPrefix}-overlay-districts`} on={districtsOn} onChange={toggleDistricts} />
      </label>
      {districtsOn && districts.status === "error" && <p className="px-1 text-xs text-primary-strong">{t("overlayError")}</p>}
    </div>
  );
}
