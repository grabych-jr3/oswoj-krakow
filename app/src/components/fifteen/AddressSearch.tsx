"use client";

import { Crosshair, LoaderCircle, MapPin, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import type { GeocodeResult } from "@/contracts/geo";
import { cn } from "@/lib/utils";
import { fetchGeocode } from "@/map/nearby";

const DEBOUNCE_MS = 200;
const MIN_CHARS = 2;

/**
 * Address field of "Kraków w 15 minut" (C4): suggestions from /api/geocode as an ARIA combobox,
 * plus a button to pick the point on the map instead. `value` shows the current point (also one picked on the map).
 */
export function AddressSearch({
  value: shown,
  onSelect,
  picking,
  onTogglePick,
}: {
  value?: string;
  onSelect: (result: GeocodeResult) => void;
  picking: boolean;
  onTogglePick: () => void;
}) {
  const t = useTranslations("Address");
  const listId = useId();
  const [value, setValue] = useState(shown ?? "");
  // A new point from outside (map click, shared link, chat) replaces what is typed.
  const [lastShown, setLastShown] = useState(shown);
  if (shown !== lastShown) {
    setLastShown(shown);
    setValue(shown ?? "");
  }
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [status, setStatus] = useState<"idle" | "loading" | "empty" | "error">("idle");
  const request = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLFormElement>(null);

  // Close the list on a click outside.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  useEffect(
    () => () => {
      request.current?.abort();
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function lookup(q: string): Promise<GeocodeResult[]> {
    request.current?.abort();
    const ctrl = new AbortController();
    request.current = ctrl;
    setStatus("loading");
    try {
      const found = await fetchGeocode(q, ctrl.signal);
      if (ctrl.signal.aborted) return [];
      setResults(found);
      setActive(found.length ? 0 : -1);
      setStatus(found.length ? "idle" : "empty");
      return found;
    } catch {
      if (!ctrl.signal.aborted) setStatus("error");
      return [];
    }
  }

  function onChange(next: string) {
    setValue(next);
    setOpen(true);
    if (timer.current) clearTimeout(timer.current);
    if (next.trim().length < MIN_CHARS) {
      request.current?.abort();
      setResults([]);
      setStatus("idle");
      return;
    }
    timer.current = setTimeout(() => void lookup(next.trim()), DEBOUNCE_MS);
  }

  function choose(result: GeocodeResult) {
    setValue(result.label);
    setOpen(false);
    setResults([]);
    setStatus("idle");
    onSelect(result);
  }

  async function submit() {
    const q = value.trim();
    if (q.length < MIN_CHARS) return;
    if (open && results[active]) return choose(results[active]);
    if (timer.current) clearTimeout(timer.current);
    const found = await lookup(q);
    setOpen(true);
    if (found[0]) choose(found[0]);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!results.length) return;
      e.preventDefault();
      setOpen(true);
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + step + results.length) % results.length);
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
      }
    }
  }

  const showList = open && value.trim().length >= MIN_CHARS && (results.length > 0 || status !== "idle");
  const optionId = (i: number) => `${listId}-opt-${i}`;

  return (
    <form
      ref={rootRef}
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="relative flex flex-col gap-1.5"
    >
      <div className="flex h-12 items-center gap-1.5 rounded-[14px] bg-card pr-1.5 pl-3.5 shadow-float">
        <span className="mr-1 size-2.5 shrink-0 rounded-full border-2 border-primary" aria-hidden />
        <label htmlFor="address-search" className="sr-only">
          {t("label")}
        </label>
        <input
          id="address-search"
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={showList && active >= 0 && results[active] ? optionId(active) : undefined}
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={t("placeholder")}
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none"
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange("");
              rootRef.current?.querySelector("input")?.focus();
            }}
            aria-label={t("clear")}
            title={t("clear")}
            className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
        <button
          type="button"
          onClick={onTogglePick}
          aria-pressed={picking}
          aria-label={picking ? t("cancelPick") : t("pick")}
          title={picking ? t("cancelPick") : t("pick")}
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-[10px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            picking ? "bg-primary-strong text-primary-foreground" : "bg-primary-soft text-primary-strong hover:bg-[oklch(0.92_0.05_27)]",
          )}
        >
          <Crosshair className="size-[18px]" aria-hidden />
        </button>
        <button
          type="submit"
          aria-label={t("submit")}
          title={t("submit")}
          className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-primary text-primary-foreground hover:bg-primary-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {status === "loading" ? (
            <LoaderCircle className="size-[18px] animate-spin" aria-hidden />
          ) : (
            <Search className="size-[18px]" strokeWidth={2.5} aria-hidden />
          )}
        </button>
      </div>

      {picking && (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-primary-strong px-3 py-2 text-[13px] font-medium text-primary-foreground shadow-float">
          <Crosshair className="size-4 shrink-0" aria-hidden />
          {t("picking")}
        </p>
      )}

      <div
        id={listId}
        role="listbox"
        aria-label={t("suggestions")}
        hidden={!showList}
        className="absolute inset-x-0 top-[52px] z-30 overflow-hidden rounded-[14px] bg-card py-1 shadow-float"
      >
        {results.map((r, i) => (
          <div
            key={`${r.label}-${i}`}
            id={optionId(i)}
            role="option"
            aria-selected={i === active}
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => choose(r)}
            onPointerEnter={() => setActive(i)}
            className={cn("flex cursor-pointer items-start gap-2 px-3 py-2 text-sm", i === active && "bg-primary-soft")}
          >
            <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate">{r.label}</span>
              {r.district && <span className="block text-xs text-muted-foreground">{r.district.name}</span>}
            </span>
          </div>
        ))}
        {results.length === 0 && status !== "idle" && (
          <p className="px-3 py-2 text-[13px] text-muted-foreground">
            {status === "loading" ? t("searching") : t("noResults")}
          </p>
        )}
      </div>
    </form>
  );
}
