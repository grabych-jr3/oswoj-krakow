import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { PlaceCategory } from "@/contracts/place";
import { Link } from "@/i18n/navigation";
import { CATEGORY_STYLES } from "@/lib/categories";

/**
 * Mini map on the home page: a static snapshot of our own basemap (fast, no map JS on
 * the home page) with a few real places marked; the whole card links to /mapa.
 *
 * public/home/map-preview.webp = /pl/mapa basemap at 960×720 (2× DPR), centre Rynek Główny
 * (19.9373, 50.0614), zoom 12.3. Marker positions are Web-Mercator projections of the real
 * coordinates onto that frame — if the image is regenerated with other parameters, recompute them.
 */
const MARKERS: { category: PlaceCategory; x: number; y: number }[] = [
  { category: "urzad", x: 67.3, y: 43.3 }, // al. Powstania Warszawskiego 10 (PESEL, meldunek)
  { category: "urzad", x: 72.0, y: 83.2 }, // ul. Wielicka 28A
  { category: "przystanek", x: 56.1, y: 40.5 }, // Dworzec Główny
  { category: "biblioteka", x: 45.1, y: 45.3 }, // Biblioteka Kraków, ul. Rajska 1
  { category: "park", x: 34.7, y: 48.0 }, // Park Jordana
  { category: "park", x: 59.5, y: 78.5 }, // Park Bednarskiego
  { category: "przedszkole", x: 71.8, y: 31.2 }, // ul. Młyńska Boczna 4
];

const LEGEND: PlaceCategory[] = ["urzad", "przedszkole", "park", "biblioteka", "przystanek"];

export function MapPreview() {
  const t = useTranslations("Home");
  const tCat = useTranslations("Categories");

  return (
    <Link
      href="/mapa"
      className="group flex flex-col overflow-hidden rounded-[28px] bg-white shadow-panel ring-1 ring-border focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ring"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-map">
        {/* image + markers zoom together on hover, so the markers stay on their places */}
        <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-[1.03]">
          <Image
            src="/home/map-preview.webp"
            alt=""
            fill
            priority
            sizes="(min-width: 1240px) 590px, (min-width: 1024px) 46vw, 100vw"
            className="object-cover"
          />
          {MARKERS.map((m, i) => {
            const { color, icon: Icon } = CATEGORY_STYLES[m.category];
            return (
              <span
                key={i}
                aria-hidden
                className="absolute grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[2.5px] border-white text-white shadow-[0_4px_12px_-2px_rgb(60_20_20/0.4)] sm:size-9"
                style={{ left: `${m.x}%`, top: `${m.y}%`, background: color }}
              >
                <Icon className="size-4" />
              </span>
            );
          })}
        </div>
        <span className="absolute right-3 bottom-3 rounded-md bg-white/85 px-1.5 py-0.5 font-mono text-[10px] text-[oklch(0.38_0.02_27)]">
          © OpenStreetMap · OpenFreeMap
        </span>
      </div>

      <div className="flex flex-col gap-3 border-t border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-base font-bold tracking-[-0.01em] text-foreground sm:text-lg">{t("mapPreviewTitle")}</span>
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {LEGEND.map((c) => (
              <li key={c} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full" style={{ background: CATEGORY_STYLES[c].color }} aria-hidden />
                {tCat(c)}
              </li>
            ))}
          </ul>
        </div>
        <span className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors group-hover:bg-primary-strong">
          {t("openMap")}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </span>
      </div>
    </Link>
  );
}
