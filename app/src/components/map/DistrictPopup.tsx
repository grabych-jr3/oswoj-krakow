"use client";

import { Globe2, Users, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { DistrictStats, PlaceCategory } from "@/contracts/place";
import { CATEGORY_STYLES } from "@/lib/categories";

const ROMAN: [number, string][] = [
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

/** Kraków numbers its districts in Roman numerals (I–XVIII). */
function roman(n: number): string {
  let out = "";
  for (const [value, numeral] of ROMAN) {
    while (n >= value) {
      out += numeral;
      n -= value;
    }
  }
  return out;
}

/** District statistics (C5): registered residents, foreigners, top citizenships, places by category. */
export function DistrictPopup({
  district,
  onClose,
  className = "w-[min(300px,calc(100vw-48px))]",
}: {
  district: DistrictStats;
  onClose: () => void;
  className?: string;
}) {
  const t = useTranslations("District");
  const tCat = useTranslations("Categories");
  const nf = new Intl.NumberFormat(useLocale());
  const { residents, foreigners } = district;
  const share = residents && foreigners !== null ? (100 * foreigners) / residents : null;
  const order = Object.keys(CATEGORY_STYLES) as PlaceCategory[];
  const places = order.filter((c) => (district.placeCounts[c] ?? 0) > 0);
  const titleId = `district-${district.number}`;

  return (
    <article aria-labelledby={titleId} className={`flex flex-col gap-3 text-foreground ${className}`}>
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[11px] font-medium tracking-[0.04em] text-primary uppercase">
            {t("label", { number: roman(district.number) })}
          </p>
          <h3 id={titleId} className="text-[15px] leading-snug font-bold">
            {district.name}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="-mt-1 -mr-1 grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
        >
          <X className="size-4" aria-hidden />
        </button>
      </header>

      <dl className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-muted px-2.5 py-2">
          <dt className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Users className="size-3" aria-hidden />
            {t("residents")}
          </dt>
          <dd className="text-[15px] font-semibold">{residents === null ? "–" : nf.format(residents)}</dd>
        </div>
        <div className="rounded-lg bg-muted px-2.5 py-2">
          <dt className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Globe2 className="size-3" aria-hidden />
            {t("foreigners")}
          </dt>
          <dd className="text-[15px] font-semibold">
            {foreigners === null ? "–" : nf.format(foreigners)}
            {share !== null && <span className="ml-1 text-xs font-normal text-muted-foreground">({share.toFixed(1)}%)</span>}
          </dd>
        </div>
      </dl>

      {district.topCitizenships.length > 0 && (
        <section className="flex flex-col gap-1">
          <h4 className="text-[13px] font-semibold">{t("citizenships")}</h4>
          <ol className="flex flex-col text-[13px]">
            {district.topCitizenships.map((c) => (
              <li key={c.name} className="flex justify-between gap-2 border-b border-border py-0.5 last:border-0">
                <span>{c.name}</span>
                <span className="font-mono text-xs text-muted-foreground">{nf.format(c.count)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {places.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <h4 className="text-[13px] font-semibold">{t("places")}</h4>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
            {places.map((c) => {
              const { color, icon: Icon } = CATEGORY_STYLES[c];
              return (
                <li key={c} className="flex min-w-0 items-center gap-1.5 text-xs">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full text-white" style={{ background: color }} aria-hidden>
                    <Icon className="size-3" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{tCat(c)}</span>
                  <strong className="font-mono">{district.placeCounts[c]}</strong>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <p className="border-t border-border pt-2.5 font-mono text-[11px] leading-snug text-muted-foreground">{t("source")}</p>
    </article>
  );
}
