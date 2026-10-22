"use client";

import { AlertCircle, CircleCheck, ExternalLink, FileText, LoaderCircle, MapPin, MessageCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ToolOutputs } from "@/contracts/chat";
import type { NearbyResult } from "@/contracts/geo";
import type { Scenario } from "@/contracts/kb";
import type { ParsedToolPart } from "@/lib/toolParts";
import type { z } from "zod";
import { useChatActions } from "./ChatActions";
import { ProcedureCard } from "./ProcedureCard";
import { NearbySummary } from "@/components/fifteen/NearbySummary";

/** Renders one tool part of an answer (PLAN.md §5.3, "Як UI рендерить інструменти"). */
export function ToolPart({ part }: { part: ParsedToolPart }) {
  const t = useTranslations("Chat");
  if (part.state === "running") {
    return (
      <p role="status" className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <LoaderCircle className="size-3.5 animate-spin text-primary" aria-hidden />
        {t(`running.${part.name}`)}
      </p>
    );
  }
  if (part.state === "error" || !part.output) {
    return (
      <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <AlertCircle className="size-3.5 text-primary" aria-hidden />
        {t("toolError")}
      </p>
    );
  }
  switch (part.name) {
    case "get_procedure":
      return <ProcedureCard procedure={part.output.procedure} />;
    case "find_places":
      return <PlacesList places={part.output.places} />;
    case "nearby_15min":
      return <NearbyCard result={part.output} />;
    case "get_scenario":
      return <ScenarioChecklist scenario={part.output.scenario} />;
    case "search_procedures":
      return <SearchHits hits={part.output.hits} />;
    case "geocode":
      return null; // the address shows up in the answer and on the map
  }
}

function useDistance() {
  const locale = useLocale();
  return (m: number) =>
    m < 1000
      ? new Intl.NumberFormat(locale, { style: "unit", unit: "meter", maximumFractionDigits: 0 }).format(Math.round(m / 10) * 10)
      : new Intl.NumberFormat(locale, { style: "unit", unit: "kilometer", maximumFractionDigits: 1 }).format(m / 1000);
}

type FoundPlace = z.infer<(typeof ToolOutputs)["find_places"]>["places"][number];

function PlacesList({ places }: { places: FoundPlace[] }) {
  const tCat = useTranslations("Categories");
  const t = useTranslations("Chat");
  const { showPlace } = useChatActions();
  const distance = useDistance();
  if (!places.length) return null;
  return (
    <ol className="flex flex-col gap-1.5">
      {places.map((p) => (
        <li key={p.id}>
          <button
            type="button"
            onClick={() => showPlace(p)}
            aria-label={`${t("markerLabel", { label: p.label })}: ${p.name}`}
            className="flex w-full items-start gap-2.5 rounded-xl border border-border bg-card p-2.5 text-left text-[13px] leading-snug hover:border-primary hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-ring"
          >
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground" aria-hidden>
              {p.label}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-semibold">{p.name}</span>
              <span className="text-muted-foreground">
                {tCat(p.category)} · {p.address}
              </span>
            </span>
            {p.distanceM !== null && <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{distance(p.distanceM)}</span>}
          </button>
        </li>
      ))}
    </ol>
  );
}

/** `nearby_15min` result: the same summary as the map panel, plus a way to open it there. */
function NearbyCard({ result }: { result: NearbyResult }) {
  const t = useTranslations("Fifteen");
  const tChat = useTranslations("Chat");
  const { showPlace, showNearby } = useChatActions();
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3.5 text-card-foreground">
      <header className="flex flex-col gap-0.5">
        <h3 className="text-[15px] font-bold">{t("title")}</h3>
        <p className="text-[13px] text-muted-foreground">
          {result.origin.label} · {t(result.mode)}
        </p>
      </header>
      <NearbySummary result={result} onPlace={showPlace} />
      <button
        type="button"
        onClick={() => showNearby(result.origin, result.mode)}
        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-[13px] font-semibold text-primary-foreground hover:bg-primary-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <MapPin className="size-4" aria-hidden />
        {tChat("showOnMap")}
      </button>
    </article>
  );
}

function ScenarioChecklist({ scenario }: { scenario: Scenario }) {
  const t = useTranslations("Chat");
  const { ask, showCategories } = useChatActions();
  const steps = [...scenario.steps].sort((a, b) => a.order - b.order);
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3.5 text-card-foreground">
      <header className="flex flex-col gap-1">
        <h3 className="text-[15px] leading-snug font-bold">{scenario.title}</h3>
        <p className="text-[13px] text-muted-foreground">
          <strong>{t("forWhom")}: </strong>
          {scenario.forWhom}
        </p>
      </header>
      <ol className="flex flex-col gap-2">
        {steps.map((s) => (
          <li key={s.order} className="flex gap-2.5 rounded-lg bg-muted p-2.5 text-[13px] leading-snug">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground" aria-hidden>
              {s.order}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="font-semibold">{s.title}</p>
              <p className="text-muted-foreground">{s.why}</p>
              {s.when && (
                <p className="flex gap-1">
                  <CircleCheck className="mt-0.5 size-3 shrink-0 text-primary" aria-hidden />
                  <span>
                    <strong>{t("deadline")}: </strong>
                    {s.when}
                  </span>
                </p>
              )}
              {s.external.map((e) => (
                <a key={e.url} href={e.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary-strong underline underline-offset-2">
                  {e.title}
                  <ExternalLink className="size-3" aria-hidden />
                </a>
              ))}
              <div className="mt-1 flex flex-wrap gap-1.5">
                {s.procedureSymbols.length > 0 && (
                  <button
                    type="button"
                    onClick={() => ask(t("stepQuestion", { title: `${s.title} (${s.procedureSymbols.join(", ")})` }))}
                    className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <MessageCircle className="size-3.5" aria-hidden />
                    {t("askStep")}
                  </button>
                )}
                {s.placeCategories.length > 0 && (
                  <button
                    type="button"
                    onClick={() => showCategories(s.placeCategories)}
                    className="inline-flex items-center gap-1 rounded-lg bg-card px-2.5 py-1.5 text-xs font-medium text-primary-strong hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <MapPin className="size-3.5" aria-hidden />
                    {t("showOnMap")}
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
      {scenario.sources.length > 0 && (
        <p className="border-t border-border pt-2 text-[11px] text-muted-foreground">
          {t("sources")}:{" "}
          {scenario.sources.map((u, i) => (
            <span key={u}>
              {i > 0 && ", "}
              <a href={u} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-primary-strong">
                {hostname(u)}
              </a>
            </span>
          ))}
        </p>
      )}
    </article>
  );
}

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function SearchHits({ hits }: { hits: { symbol: string; title: string; bipUrl: string }[] }) {
  const t = useTranslations("Chat");
  if (!hits.length) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[11px] font-medium text-muted-foreground">{t("found")}</p>
      <ul className="flex flex-wrap gap-1.5">
        {hits.slice(0, 4).map((h) => (
          <li key={h.symbol}>
            <a
              href={h.bipUrl}
              target="_blank"
              rel="noreferrer"
              title={h.title}
              className="flex max-w-[260px] items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs hover:border-primary hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-ring"
            >
              <FileText className="size-3 shrink-0 text-primary" aria-hidden />
              <span className="shrink-0 font-mono font-medium whitespace-nowrap">{h.symbol}</span>
              <span className="truncate text-muted-foreground">{h.title}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
