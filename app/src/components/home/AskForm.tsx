"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";

/** Hero question box: opens the map with the question pre-filled in the chat (`/mapa?q=`). */
export function AskForm() {
  const t = useTranslations("Home");
  const router = useRouter();
  const [q, setQ] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const v = q.trim();
        router.push(v ? { pathname: "/mapa", query: { q: v } } : "/mapa");
      }}
      className="flex max-w-[580px] items-center gap-2 rounded-[18px] border-2 border-primary py-[7px] pr-[7px] pl-4 sm:pl-5 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring"
    >
      <label htmlFor="home-ask" className="sr-only">
        {t("askLabel")}
      </label>
      <input
        id="home-ask"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("askPlaceholder")}
        autoComplete="off"
        className="h-[46px] min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none sm:text-[17px]"
      />
      <button
        type="submit"
        className="h-[46px] shrink-0 rounded-xl bg-primary px-4 text-base sm:px-[22px] font-semibold text-primary-foreground hover:bg-primary-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {t("ask")}
      </button>
    </form>
  );
}
