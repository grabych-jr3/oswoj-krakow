"use client";

import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId } from "react";
import type { NearbyResult } from "@/contracts/geo";
import type { Place, PlaceCategory } from "@/contracts/place";
import { CATEGORY_STYLES } from "@/lib/categories";
import { indexGroups } from "@/lib/fifteen";
import { cn } from "@/lib/utils";

type NearbyPlace = NearbyResult["places"][number];

/**
 * What is within 15 minutes (C4): the "Indeks 15 minut" with its six groups, counts per category and
 * the reachable places. Shared by the map panel and the chat card of `nearby_15min`.
 */
export function NearbySummary({
  result,
  onPlace,
  placesOpen = false,
  detailsClassName,
  shortClassName = "hidden",
}: {
  result: NearbyResult;
  onPlace: (place: Place) => void;
  /** Open the first per-category place lists (the map panel has room; the chat card keeps them folded). */
  placesOpen?: boolean;
  /** Classes for the group checklist and the places (the phone panel folds them). */
  detailsClassName?: string;
  /** Classes for the one-line "missing" summary that replaces the checklist while folded. */
  shortClassName?: string;
}) {
  const t = useTranslations("Fifteen");
  const tCat = useTranslations("Categories");
  const indexId = useId();
  const score = Math.round(result.score.value);
  const groups = indexGroups(result.counts);
  const missing = groups.filter((g) => !g.present);
  const byCategory = groupPlaces(result.places);

  return (
    <div className="flex flex-col gap-3">
      <section aria-labelledby={indexId} className="flex items-start gap-3">
        <div
          className="grid size-14 shrink-0 place-items-center rounded-full"
          style={{ background: `conic-gradient(var(--color-primary) ${score * 3.6}deg, var(--color-muted) 0)` }}
          role="img"
          aria-label={`${t("index")}: ${score}/100`}
        >
          <span className="grid size-11 place-items-center rounded-full bg-card text-lg font-bold text-primary">{score}</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h4 id={indexId} className="text-[13px] leading-tight font-semibold">
            {t("index")}
            <span className={cn("block text-xs font-normal text-muted-foreground", detailsClassName)}>{t("indexHelp")}</span>
          </h4>
          <p className={cn("text-xs", shortClassName)}>
            {missing.length ? `${t("missing")}: ${missing.map((g) => t(`groups.${g.id}`)).join(", ")}` : t("allGroups")}
          </p>
          <ul className={cn("grid grid-cols-1 gap-x-3 gap-y-0.5 text-xs min-[380px]:grid-cols-2", detailsClassName)}>
            {groups.map((g) => (
              <li key={g.id} className={cn("flex items-center gap-1", !g.present && "text-muted-foreground")}>
                {g.present ? (
                  <Check className="size-3.5 shrink-0 text-[#207029]" aria-hidden />
                ) : (
                  <X className="size-3.5 shrink-0 text-primary" aria-hidden />
                )}
                <span>
                  <span className="sr-only">{g.present ? "✓ " : "✗ "}</span>
                  {t(`groups.${g.id}`)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className={cn("flex flex-col gap-3", detailsClassName)}>
      {byCategory.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">{t("noPlaces")}</p>
      ) : (
        <section aria-label={t("inReach")} className="flex flex-col gap-1">
          <h4 className="text-[13px] font-semibold">{t("inReach")}</h4>
          <ul className="flex flex-col gap-1">
            {byCategory.map(({ category, places }, i) => {
              const { color, icon: Icon } = CATEGORY_STYLES[category];
              const count = result.counts[category] ?? places.length;
              return (
                <li key={category}>
                  <details open={placesOpen && i < 2} className="group/cat rounded-lg">
                    <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-1 py-1 text-[13px] hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
                      <span className="grid size-6 shrink-0 place-items-center rounded-full text-white" style={{ background: color }} aria-hidden>
                        <Icon className="size-3.5" />
                      </span>
                      <span className="min-w-0 flex-1 truncate">{tCat(category)}</span>
                      <span className="font-mono text-xs font-semibold">{count}</span>
                      <span className="text-muted-foreground transition-transform group-open/cat:rotate-90" aria-hidden>
                        ›
                      </span>
                    </summary>
                    <ul className="flex flex-col pb-1 pl-8">
                      {places.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => onPlace(p)}
                            className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-[13px] hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                          >
                            <span className="min-w-0 flex-1 truncate">{p.name}</span>
                            {p.minutes !== null && (
                              <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{t("minutes", { n: Math.round(p.minutes) })}</span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </details>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <p className="font-mono text-[10px] leading-snug text-muted-foreground">
        {t("method")}: {result.method}
      </p>
      </div>
    </div>
  );
}

/** Places by category, categories in index order first, places by travel time. */
function groupPlaces(places: NearbyPlace[]): { category: PlaceCategory; places: NearbyPlace[] }[] {
  const map = new Map<PlaceCategory, NearbyPlace[]>();
  for (const p of places) map.set(p.category, [...(map.get(p.category) ?? []), p]);
  const order = Object.keys(CATEGORY_STYLES) as PlaceCategory[];
  return [...map.entries()]
    .sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
    .map(([category, ps]) => ({ category, places: ps.sort((a, b) => (a.minutes ?? 99) - (b.minutes ?? 99)) }));
}
