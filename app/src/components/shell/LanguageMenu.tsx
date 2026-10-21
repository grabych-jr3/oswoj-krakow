"use client";

import { Check, ChevronDown } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

const LANGS: Record<string, { code: string; name: string }> = {
  pl: { code: "PL", name: "Polski" },
  uk: { code: "UA", name: "Українська" },
  en: { code: "EN", name: "English" },
};

/**
 * Compact language picker (dropdown) for narrow screens, in brand red and white.
 * `onPrimary` = white button for the red home header; default = red button on white.
 */
export function LanguageMenu({ onPrimary = false, className }: { onPrimary?: boolean; className?: string }) {
  const t = useTranslations("Header");
  const locale = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    // Move focus to the current language so arrow keys start from it.
    rootRef.current?.querySelector<HTMLElement>('[aria-current="true"]')?.focus();
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function onListKey(e: React.KeyboardEvent<HTMLUListElement>) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const links = [...e.currentTarget.querySelectorAll<HTMLElement>("a")];
    const i = links.indexOf(document.activeElement as HTMLElement);
    links[(i + (e.key === "ArrowDown" ? 1 : links.length - 1)) % links.length]?.focus();
  }

  const current = LANGS[locale] ?? LANGS.pl;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${t("language")}: ${current.name}`}
        className={cn(
          "flex h-9 items-center gap-1 rounded-[10px] pr-2 pl-3 font-mono text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
          onPrimary
            ? "bg-white text-primary hover:bg-primary-soft focus-visible:outline-white"
            : "bg-primary text-primary-foreground hover:bg-primary-strong focus-visible:outline-ring",
        )}
      >
        {current.code}
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <ul
          id={listId}
          onKeyDown={onListKey}
          className="absolute top-[calc(100%+6px)] right-0 z-50 w-44 overflow-hidden rounded-xl border border-primary/15 bg-white p-1 shadow-panel"
        >
          {routing.locales.map((l) => {
            const active = l === locale;
            return (
              <li key={l}>
                <Link
                  href={pathname}
                  locale={l}
                  hrefLang={l}
                  lang={l}
                  aria-current={active ? "true" : undefined}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-primary-soft focus-visible:bg-primary-soft",
                  )}
                >
                  <span className={cn("w-6 font-mono text-xs font-semibold", active ? "text-white" : "text-primary")}>{LANGS[l].code}</span>
                  <span className="flex-1">{LANGS[l].name}</span>
                  {active && <Check className="size-4" aria-hidden />}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
