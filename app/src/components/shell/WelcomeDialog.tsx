"use client";

import { Map as MapIcon, MessageCircle, Timer } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { LogoMark } from "@/components/brand/Logo";

/** Classes of the welcome dialog; without a modal (server HTML) it centres itself and dims the page. */
export const WELCOME_DIALOG_CLASS =
  "m-auto w-[min(480px,calc(100%-32px))] rounded-3xl bg-card p-0 text-card-foreground shadow-panel backdrop:bg-[oklch(0.22_0.02_27/0.45)] [&:not(:modal)]:fixed [&:not(:modal)]:inset-0 [&:not(:modal)]:z-50 [&:not(:modal)]:shadow-[0_0_0_100vmax_oklch(0.22_0.02_27/0.45)]";

/** First-visit dialog: what the app does, disclaimer, data sources (PLAN.md §2.4, C1). */
export function WelcomeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  // Open in the server HTML (as a plain, non-modal dialog) so it paints with the page; after
  // hydration it becomes a real modal: backdrop, focus trap, Esc.
  const [openInHtml] = useState(open);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.matches(":modal")) {
      // Dropping the attribute (unlike close()) fires no "close" event, so the state stays open.
      d.removeAttribute("open");
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={ref} open={openInHtml} onClose={onClose} aria-labelledby="welcome-title" className={WELCOME_DIALOG_CLASS}>
      <WelcomeBody />
    </dialog>
  );
}

/** What the app does, the disclaimer and the data sources; the "start" button closes the dialog around it. */
export function WelcomeBody() {
  const t = useTranslations("Welcome");
  const points = [
    { icon: MessageCircle, text: t("point1") },
    { icon: MapIcon, text: t("point2") },
    { icon: Timer, text: t("point3") },
  ];

  return (
    <div className="flex flex-col gap-5 p-6">
      <div className="flex items-center gap-3">
        <LogoMark className="size-10" />
        <div>
          <h2 id="welcome-title" className="text-xl font-bold tracking-[-0.02em]">
            {t("title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("intro")}</p>
        </div>
      </div>

      <ul className="flex flex-col gap-3">
        {points.map(({ icon: Icon, text }) => (
          <li key={text} className="flex gap-3 text-[15px] leading-snug">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-strong">
              <Icon className="size-4" aria-hidden />
            </span>
            <span className="pt-1">{text}</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-3 rounded-2xl bg-muted p-4 text-sm leading-snug">
        <p>
          <strong className="font-semibold">{t("disclaimerTitle")}: </strong>
          {t("disclaimer")}
        </p>
        <p>
          <strong className="font-semibold">{t("sourcesTitle")}: </strong>
          <span className="text-muted-foreground">{t("sources")}</span>
        </p>
      </div>

      <form method="dialog">
        <button
          type="submit"
          autoFocus
          className="h-11 w-full rounded-xl bg-primary text-[15px] font-semibold text-primary-foreground hover:bg-primary-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {t("start")}
        </button>
      </form>
    </div>
  );
}
