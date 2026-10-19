"use client";

import { Info } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Logo } from "@/components/brand/Logo";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

const LANG_LABELS: Record<string, string> = { pl: "PL", uk: "UA", en: "EN" };

export function TopBar({ onAbout }: { onAbout: () => void }) {
  const t = useTranslations("Header");
  return (
    <div className="flex w-full flex-wrap items-center gap-3 rounded-2xl bg-card py-2 pr-2 pl-3 shadow-float md:w-max md:max-w-full">
      <Link href="/" aria-label={t("home")} className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        <Logo />
      </Link>
      <div className="ml-auto flex items-center gap-1.5 md:ml-0">
        <LanguageSwitcher />
        <button
          type="button"
          onClick={onAbout}
          aria-label={t("about")}
          title={t("about")}
          className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <Info className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

export function LanguageSwitcher() {
  const t = useTranslations("Header");
  const locale = useLocale();
  const pathname = usePathname();
  return (
    <nav aria-label={t("language")} className="flex gap-0.5 rounded-[10px] bg-secondary p-[3px]">
      {routing.locales.map((l) => {
        const active = l === locale;
        return (
          <Link
            key={l}
            href={pathname}
            locale={l}
            hrefLang={l}
            lang={l}
            aria-current={active ? "true" : undefined}
            className={cn(
              "rounded-[7px] px-2.5 py-1.5 font-mono text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
              active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-card",
            )}
          >
            {LANG_LABELS[l]}
          </Link>
        );
      })}
    </nav>
  );
}

/** Address field for "Kraków w 15 minut". Visual only in C1; the search is wired in C4. */
export function AddressSearch() {
  const t = useTranslations("Address");
  return (
    <form role="search" onSubmit={(e) => e.preventDefault()} className="flex h-12 items-center gap-2.5 rounded-[14px] bg-card px-3.5 shadow-float">
      <span className="size-2.5 shrink-0 rounded-full border-2 border-primary" aria-hidden />
      <label htmlFor="address-search" className="sr-only">
        {t("label")}
      </label>
      <input
        id="address-search"
        type="search"
        autoComplete="street-address"
        placeholder={t("placeholder")}
        className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none"
      />
      <span className="font-mono text-[11px] font-medium whitespace-nowrap text-primary" aria-hidden>
        {t("badge")}
      </span>
    </form>
  );
}
