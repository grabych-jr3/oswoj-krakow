"use client";

import { Info, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Logo } from "@/components/brand/Logo";
import { LanguageMenu } from "@/components/shell/LanguageMenu";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

const LANG_LABELS: Record<string, string> = { pl: "PL", uk: "UA", en: "EN" };

export function TopBar({ onAbout }: { onAbout: () => void }) {
  const t = useTranslations("Header");
  return (
    <div className="flex w-full items-center gap-3 rounded-2xl bg-card py-2 pr-2 pl-3 shadow-float md:w-max md:max-w-full">
      <Link href="/" aria-label={t("home")} className="min-w-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        <Logo />
      </Link>
      <div className="ml-auto flex shrink-0 items-center gap-1.5 md:ml-0">
        {/* Phones: dropdown keeps logo and language on one row; desktop: segmented switch */}
        <LanguageMenu className="md:hidden" />
        <LanguageSwitcher className="hidden md:flex" />
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

/** `onPrimary` = styling for the red sticky header of the home page. */
export function LanguageSwitcher({ onPrimary = false, className }: { onPrimary?: boolean; className?: string }) {
  const t = useTranslations("Header");
  const locale = useLocale();
  const pathname = usePathname();
  return (
    <nav aria-label={t("language")} className={cn("flex gap-0.5 rounded-[10px] p-[3px]", onPrimary ? "bg-white/15" : "bg-secondary", className)}>
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
              "rounded-[7px] px-2.5 py-1.5 font-mono text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-1",
              onPrimary
                ? active
                  ? "bg-white text-primary focus-visible:outline-white"
                  : "text-white hover:bg-white/15 focus-visible:outline-white"
                : active
                  ? "bg-primary text-primary-foreground focus-visible:outline-ring"
                  : "text-foreground hover:bg-card focus-visible:outline-ring",
            )}
          >
            {LANG_LABELS[l]}
          </Link>
        );
      })}
    </nav>
  );
}

/** Address field for "Kraków w 15 minut". Visual only so far; the search is wired in C4. */
export function AddressSearch() {
  const t = useTranslations("Address");
  return (
    <form role="search" onSubmit={(e) => e.preventDefault()} className="flex h-12 items-center gap-2.5 rounded-[14px] bg-card pr-1.5 pl-3.5 shadow-float">
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
      <button
        type="submit"
        aria-label={t("submit")}
        title={t("submit")}
        className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-primary text-primary-foreground hover:bg-primary-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Search className="size-[18px]" strokeWidth={2.5} aria-hidden />
      </button>
    </form>
  );
}
