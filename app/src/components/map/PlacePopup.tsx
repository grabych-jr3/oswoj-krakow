"use client";

import { ExternalLink, MapPin, MessageCircle, Phone, X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Place } from "@/contracts/place";
import { CATEGORY_STYLES } from "@/lib/categories";

/** Human name of a data source from its URL (layers come from the portal, BIP, ZTP…). */
function sourceName(url: string): string {
  if (url.includes("otwartedane.um.krakow.pl")) return "Otwarte Dane Miasta Krakowa";
  if (url.includes("bip.krakow.pl")) return "BIP Kraków";
  if (url.includes("arcgis.com") || url.includes("ztp.krakow.pl")) return "ZTP Kraków";
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

// Numeric attributes worth showing, in display order (keys from zone A layers, PLAN.md §5.3 Place.attrs).
const NUMBER_ATTRS = ["children", "students", "groups", "places"] as const;

export function PlacePopup({
  place,
  onClose,
  onAsk,
  className = "w-[min(300px,calc(100vw-48px))]",
}: {
  place: Place;
  onClose: () => void;
  /** Map → chat: ask the assistant about this place. */
  onAsk?: (place: Place) => void;
  className?: string;
}) {
  const t = useTranslations("Place");
  const tCat = useTranslations("Categories");
  const { color, icon: Icon } = CATEGORY_STYLES[place.category];
  const attrs = place.attrs;
  const numbers = NUMBER_ATTRS.filter((k) => typeof attrs[k] === "number");
  const kind = typeof attrs.type === "string" ? attrs.type : null;
  const publicLabel = typeof attrs.public === "boolean" ? (attrs.public ? t("public") : t("nonPublic")) : null;
  const updated = place.source.updatedAt;

  return (
    <article aria-labelledby={`place-${place.id}`} className={`flex flex-col gap-3 text-foreground ${className}`}>
      <header className="flex items-start gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-full text-white" style={{ background: color }} aria-hidden>
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[11px] font-medium tracking-[0.04em] uppercase" style={{ color }}>
            {tCat(place.category)}
          </p>
          <h3 id={`place-${place.id}`} className="text-[15px] leading-snug font-bold">
            {place.name}
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

      <p className="flex gap-1.5 text-[13px] leading-snug">
        <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span>
          {place.address}
          {place.district && <span className="text-muted-foreground"> · {place.district.name}</span>}
        </span>
      </p>

      {(kind || publicLabel) && (
        <p className="flex flex-wrap gap-1.5">
          {[kind, publicLabel].filter(Boolean).map((label) => (
            <span key={label} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {label}
            </span>
          ))}
        </p>
      )}

      {numbers.length > 0 && (
        <dl className="grid grid-cols-2 gap-2">
          {numbers.map((k) => (
            <div key={k} className="rounded-lg bg-muted px-2.5 py-2">
              <dt className="text-[11px] text-muted-foreground">{t(k)}</dt>
              <dd className="text-[15px] font-semibold">{attrs[k] as number}</dd>
            </div>
          ))}
        </dl>
      )}

      {place.phone && (
        <a
          href={`tel:${place.phone.replace(/\s/g, "")}`}
          className="flex items-center gap-1.5 text-[13px] font-medium text-primary-strong hover:underline focus-visible:outline-2 focus-visible:outline-ring"
        >
          <Phone className="size-3.5" aria-hidden />
          {place.phone}
        </a>
      )}

      {onAsk && (
        <button
          type="button"
          onClick={() => onAsk(place)}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-[13px] font-semibold text-primary-foreground hover:bg-primary-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <MessageCircle className="size-4" aria-hidden />
          {t("ask")}
        </button>
      )}

      <a
        href={place.source.url}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-1 border-t border-border pt-2.5 font-mono text-[11px] text-muted-foreground hover:text-primary-strong focus-visible:outline-2 focus-visible:outline-ring"
      >
        {t("source")}: {sourceName(place.source.url)}
        {updated ? ` · ${t("asOf", { date: updated })}` : ""}
        <ExternalLink className="size-3" aria-hidden />
      </a>
    </article>
  );
}
