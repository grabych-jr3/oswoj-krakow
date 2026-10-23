import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense, use } from "react";
import { AppShell, type InitialNearby } from "@/components/shell/AppShell";
import { AppShellSkeleton } from "@/components/shell/AppShellSkeleton";
import { TravelMode } from "@/contracts/geo";
import { WELCOME_SEEN_KEY } from "@/lib/welcome";

export async function generateMetadata({ params }: PageProps<"/[locale]/mapa">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Meta" });
  return { title: t("mapTitle") };
}

// Kraków with a margin, as in /api/nearby: other points in a link are ignored.
const BOUNDS = { minLng: 19.5, maxLng: 20.5, minLat: 49.8, maxLat: 50.3 };

/** `?lng=…&lat=…&mode=walk|transit`: a shared "Kraków w 15 minut" view. */
function parseNearby(params: Record<string, string | string[] | undefined>): InitialNearby | undefined {
  const lng = Number(params.lng);
  const lat = Number(params.lat);
  if (typeof params.lng !== "string" || typeof params.lat !== "string" || !Number.isFinite(lng) || !Number.isFinite(lat)) return undefined;
  if (lng < BOUNDS.minLng || lng > BOUNDS.maxLng || lat < BOUNDS.minLat || lat > BOUNDS.maxLat) return undefined;
  const mode = TravelMode.safeParse(params.mode);
  return { coords: [lng, lat], mode: mode.success ? mode.data : "walk" };
}

// `?q=` carries a question typed on the home page into the chat; `?lng&lat&mode` opens a 15-minute view.
async function MapWithQuestion({ searchParams }: { searchParams: PageProps<"/[locale]/mapa">["searchParams"] }) {
  const params = await searchParams;
  const welcomeSeen = (await cookies()).get(WELCOME_SEEN_KEY)?.value === "1";
  const question = typeof params.q === "string" ? params.q.trim().slice(0, 500) : "";
  return <AppShell initialQuestion={question || undefined} initialNearby={parseNearby(params)} welcomeSeen={welcomeSeen} />;
}

export default function MapPage({ params, searchParams }: PageProps<"/[locale]/mapa">) {
  const { locale } = use(params);
  setRequestLocale(locale);
  // Search params and the welcome cookie are request-time data, so this part streams in. Until then the
  // static shell shows the same page without the map (see AppShellSkeleton).
  return (
    <Suspense fallback={<AppShellSkeleton />}>
      <MapWithQuestion searchParams={searchParams} />
    </Suspense>
  );
}
