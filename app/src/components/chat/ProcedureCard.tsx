"use client";

import { CalendarCheck, Clock, ExternalLink, FileText, Languages, MapPin, Paperclip, Phone } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import type { Procedure } from "@/contracts/kb";
import { bookingLink } from "@/lib/booking";
import { officeToPlace } from "@/map/chatMap";
import { useChatActions } from "./ChatActions";
import { Markdown } from "./Markdown";

const SECTIONS = [
  ["dokumenty", "documents", true],
  ["oplaty", "fees", false],
  ["sposob", "how", false],
  ["kogoDotyczy", "whoFor", false],
] as const;

/** `get_procedure` result: the BIP service card (PLAN.md §5.3). */
export function ProcedureCard({ procedure }: { procedure: Procedure }) {
  const t = useTranslations("Chat");
  const { showPlace } = useChatActions();
  const locale = useLocale();
  // Machine translation in the interface language (zone B); the Polish card stays the binding version.
  const translation = locale === "pl" ? undefined : procedure.translations?.[locale as "uk" | "en"];
  const [original, setOriginal] = useState(false);
  const tr = translation && !original ? translation : null;
  // A translated section falls back to Polish where the translation has none.
  const sections = { ...procedure.sections, ...(tr ? Object.fromEntries(Object.entries(tr.sections).filter(([, v]) => v)) : {}) };
  const lang = tr ? locale : "pl";

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3.5 text-card-foreground">
      <header className="flex flex-col gap-1">
        <p className="flex items-center gap-1.5 font-mono text-[11px] font-medium tracking-[0.04em] text-primary uppercase">
          <FileText className="size-3.5" aria-hidden />
          {procedure.symbol}
          {procedure.department && <span className="truncate text-muted-foreground normal-case"> · {procedure.department}</span>}
        </p>
        <h3 lang={lang} className="text-[15px] leading-snug font-bold">
          {tr ? tr.title : procedure.title}
        </h3>
        {/* The official Polish name stays visible: that is what the office calls it. */}
        {tr && (
          <p lang="pl" className="text-xs text-muted-foreground">
            {t("officialName")}: <span className="font-medium">{procedure.title}</span>
          </p>
        )}
      </header>

      {translation ? (
        <p className="flex gap-2 rounded-lg border border-dashed border-border px-2.5 py-1.5 text-xs leading-snug text-muted-foreground">
          <Languages className="mt-px size-3.5 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0">
            {tr ? t("machineTranslation") : t("originalShown")}{" "}
            <button
              type="button"
              onClick={() => setOriginal((o) => !o)}
              aria-pressed={original}
              className="rounded font-semibold whitespace-nowrap text-primary-strong underline underline-offset-2 hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
            >
              {original ? t("showTranslation") : t("showOriginal")}
            </button>
          </span>
        </p>
      ) : (
        locale !== "pl" && (
          <p className="flex gap-2 rounded-lg border border-dashed border-border px-2.5 py-1.5 text-xs leading-snug text-muted-foreground">
            <Languages className="mt-px size-3.5 shrink-0 text-primary" aria-hidden />
            {t("noTranslation")}
          </p>
        )
      )}

      {sections.termin && (
        <p className="flex gap-2 rounded-lg bg-primary-soft px-2.5 py-2 text-[13px] leading-snug">
          <Clock className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
          <span lang={lang}>
            <strong>{t("deadline")}: </strong>
            {sections.termin}
          </span>
        </p>
      )}

      {SECTIONS.map(([key, label, open]) =>
        sections[key] ? (
          <details key={key} open={open} className="group/sec rounded-lg border border-border">
            <summary className="cursor-pointer list-none rounded-lg px-2.5 py-2 text-[13px] font-semibold marker:hidden hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
              <span className="mr-1.5 inline-block text-primary transition-transform group-open/sec:rotate-90" aria-hidden>
                ›
              </span>
              {t(label)}
            </summary>
            <div lang={lang} className="px-2.5 pb-2.5 text-[13px] leading-normal">
              <Markdown text={sections[key]!} />
            </div>
          </details>
        ) : null,
      )}

      {procedure.offices.length > 0 && (
        <section className="flex flex-col gap-2">
          <h4 className="text-[13px] font-semibold">{t("offices")}</h4>
          <ol className="flex flex-col gap-2">
            {procedure.offices.map((office, i) => {
              const place = officeToPlace(office, procedure);
              return (
                <li key={office.id} className="flex gap-2.5 rounded-lg bg-muted p-2.5 text-[13px] leading-snug">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground" aria-hidden>
                    {i + 1}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="font-semibold">{office.name}</p>
                    <p className="flex gap-1">
                      <MapPin className="mt-0.5 size-3 shrink-0 text-muted-foreground" aria-hidden />
                      {office.address}
                    </p>
                    {office.hours && (
                      <p className="flex gap-1 text-muted-foreground">
                        <Clock className="mt-0.5 size-3 shrink-0" aria-hidden />
                        <span>
                          <span className="sr-only">{t("hours")}: </span>
                          {office.hours}
                        </span>
                      </p>
                    )}
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {office.bookingUrl && (
                        <a
                          href={bookingLink(office.bookingUrl)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        >
                          <CalendarCheck className="size-3.5" aria-hidden />
                          {t("book")}
                        </a>
                      )}
                      {office.phone && (
                        <a
                          href={`tel:${office.phone.replace(/\s/g, "")}`}
                          className="inline-flex items-center gap-1 rounded-lg bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-ring"
                        >
                          <Phone className="size-3.5" aria-hidden />
                          {office.phone}
                        </a>
                      )}
                      {place && (
                        <button
                          type="button"
                          onClick={() => showPlace(place)}
                          className="inline-flex items-center gap-1 rounded-lg bg-card px-2.5 py-1.5 text-xs font-medium text-primary-strong hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-ring"
                        >
                          <MapPin className="size-3.5" aria-hidden />
                          {t("showOnMap")}
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {procedure.attachments.length > 0 && (
        <details className="rounded-lg border border-border">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-lg px-2.5 py-2 text-[13px] font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
            <Paperclip className="size-3.5 text-primary" aria-hidden />
            {t("attachments")} ({procedure.attachments.length})
          </summary>
          <ul className="flex flex-col gap-1 px-2.5 pb-2.5 text-[13px]">
            {procedure.attachments.map((a) => (
              <li key={a.url}>
                <a href={a.url} target="_blank" rel="noreferrer" className="text-primary-strong underline underline-offset-2 hover:text-primary">
                  {a.title}
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}

      <a
        href={procedure.bipUrl}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-1 border-t border-border pt-2.5 text-[13px] font-semibold text-primary-strong hover:underline focus-visible:outline-2 focus-visible:outline-ring"
      >
        {t("bip")}: {procedure.symbol}
        <ExternalLink className="size-3.5" aria-hidden />
      </a>
    </article>
  );
}
