"use client";

import { Layers, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import type { PlaceCategory } from "@/contracts/place";
import { CATEGORY_STYLES } from "@/lib/categories";
import { cn } from "@/lib/utils";
import type { LayerInfo } from "@/map/places";

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
};

/** List of map layers with counts and switches (C2). */
export function LayerPanel({ index, error, enabled, loading, onToggle, onSetAll, className, idPrefix = "layers" }: Props) {
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
        {index && (
          <button
            type="button"
            onClick={() => onSetAll(!allOn)}
            className="rounded-md px-1.5 py-0.5 text-xs font-medium text-primary-strong hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-ring"
          >
            {allOn ? t("hideAll") : t("showAll")}
          </button>
        )}
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
    </section>
  );
}
