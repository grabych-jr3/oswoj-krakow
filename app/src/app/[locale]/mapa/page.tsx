import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense, use } from "react";
import { AppShell } from "@/components/shell/AppShell";

export async function generateMetadata({ params }: PageProps<"/[locale]/mapa">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Meta" });
  return { title: t("mapTitle") };
}

// `?q=` carries a question typed on the home page into the chat.
async function MapWithQuestion({ searchParams }: { searchParams: PageProps<"/[locale]/mapa">["searchParams"] }) {
  const { q } = await searchParams;
  const question = typeof q === "string" ? q.trim().slice(0, 500) : "";
  return <AppShell initialQuestion={question || undefined} />;
}

export default function MapPage({ params, searchParams }: PageProps<"/[locale]/mapa">) {
  const { locale } = use(params);
  setRequestLocale(locale);
  // Search params are request-time data, so the page streams in. The fallback is a plain
  // map-coloured placeholder, not a second AppShell: mounting a map in the fallback and
  // replacing it a moment later aborted MapLibre mid-initialisation ("'container' must be …").
  return (
    <Suspense fallback={<div aria-hidden className="h-dvh bg-map" />}>
      <MapWithQuestion searchParams={searchParams} />
    </Suspense>
  );
}
