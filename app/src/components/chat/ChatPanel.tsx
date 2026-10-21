"use client";

import { ChevronUp, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { forwardRef, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Msg = { id: number; role: "user" | "bot"; text: string };

type Props = {
  /** Mobile bottom sheet state; on md+ the panel is always fully open. */
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  /** Question typed on the home page (`/mapa?q=`); asked as soon as the chat opens. */
  initialQuestion?: string;
};

/**
 * Chat shell from the design (red panel). C1: layout, greeting, suggestions and input.
 * Real answers (streaming, procedure cards, map actions) arrive in C3 via /api/chat.
 */
export const ChatPanel = forwardRef<HTMLElement, Props>(function ChatPanel(
  { expanded, onExpandedChange, initialQuestion },
  ref,
) {
  const t = useTranslations("Chat");
  // Derived from props during render, so server and client markup match.
  const [msgs, setMsgs] = useState<Msg[]>(() =>
    initialQuestion
      ? [
          { id: 1, role: "user", text: initialQuestion },
          { id: 2, role: "bot", text: t("comingSoon") },
        ]
      : [],
  );
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(initialQuestion ? 3 : 1);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs]);

  function send(text: string) {
    const q = text.trim();
    if (!q) return;
    const id = nextId.current;
    nextId.current += 2;
    setMsgs((m) => [...m, { id, role: "user", text: q }, { id: id + 1, role: "bot", text: t("comingSoon") }]);
    setInput("");
    onExpandedChange(true);
  }

  const suggestions = t.raw("suggestions") as string[];

  // --- Mobile swipe on the sheet header -------------------------------------------------
  // The sheet stays anchored to the bottom edge and its height follows the finger, so it never
  // detaches from the screen bottom; on release it snaps open or closed.
  const SWIPE_PX = 40; // distance that counts as a swipe
  const MIN_SHEET_PX = 96;
  const drag = useRef<{ startY: number; startH: number; moved: boolean; onHandle: boolean } | null>(null);
  const [dragH, setDragH] = useState<number | null>(null);

  function onDragStart(e: React.PointerEvent<HTMLDivElement>) {
    if (window.matchMedia("(min-width: 768px)").matches) return; // desktop: no sheet
    const target = e.target as HTMLElement;
    if (target.closest("button")) return; // let the header buttons work normally
    const sheet = e.currentTarget.closest("aside");
    if (!sheet) return;
    drag.current = {
      startY: e.clientY,
      startH: sheet.getBoundingClientRect().height,
      moved: false,
      onHandle: !!target.closest("[data-drag-handle]"),
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onDragMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    const dy = e.clientY - d.startY;
    if (Math.abs(dy) > 6) d.moved = true;
    if (!d.moved) return;
    const maxH = window.innerHeight * 0.85;
    setDragH(Math.min(maxH, Math.max(MIN_SHEET_PX, d.startH - dy)));
  }

  function onDragEnd(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const dy = e.clientY - d.startY;
    setDragH(null);
    if (!d.moved) {
      if (d.onHandle) onExpandedChange(!expanded); // tap on the handle
      return;
    }
    if (!expanded && dy < -SWIPE_PX) onExpandedChange(true);
    else if (expanded && dy > SWIPE_PX) onExpandedChange(false);
  }

  return (
    <aside
      ref={ref}
      aria-label={t("title")}
      data-expanded={expanded}
      data-dragging={dragH !== null}
      style={dragH !== null ? { height: dragH } : undefined}
      className={cn(
        "group fixed inset-x-0 bottom-0 z-20 flex max-h-[85dvh] flex-col rounded-t-3xl bg-primary text-primary-foreground shadow-[0_-12px_40px_-16px_rgb(80_10_10/0.55)]",
        "data-[expanded=true]:h-[85dvh]",
        "md:static md:z-auto md:h-auto md:max-h-none md:w-[30%] md:min-w-[380px] md:shrink-0 md:rounded-none md:shadow-none md:data-[expanded=true]:h-auto",
      )}
    >
      {/* Mobile drag zone (grab handle + header): swipe up opens, swipe down closes, tap on the handle toggles.
          Keyboard and screen readers use the chevron button. */}
      <div
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
        className="touch-none select-none md:touch-auto md:select-auto"
      >
      <div data-drag-handle aria-hidden className="flex cursor-grab justify-center pt-2.5 pb-1 md:hidden">
        <span className="h-1.5 w-11 rounded-full bg-white/60" />
      </div>

      <header className="flex items-center justify-between gap-3 px-5 pt-2 pb-3 md:px-[22px] md:pt-5 md:pb-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-xl font-bold tracking-[-0.02em] md:text-[22px]">{t("title")}</h2>
          <p className="truncate text-[13px] text-on-primary-muted">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMsgs([])}
            aria-label={t("reset")}
            title={t("reset")}
            className="grid size-9 place-items-center rounded-[10px] border-[1.5px] border-white/55 text-[13px] font-medium whitespace-nowrap hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white md:flex md:size-auto md:px-3 md:py-[7px]"
          >
            <RotateCcw className="size-4 md:hidden" aria-hidden />
            <span className="hidden md:inline">{t("reset")}</span>
          </button>
          <button
            type="button"
            onClick={() => onExpandedChange(!expanded)}
            aria-expanded={expanded}
            aria-controls="chat-messages"
            aria-label={expanded ? t("collapse") : t("expand")}
            className="grid size-9 place-items-center rounded-[10px] hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white md:hidden"
          >
            <ChevronUp className={cn("size-5 transition-transform", expanded && "rotate-180")} aria-hidden />
          </button>
        </div>
      </header>
      </div>

      <div
        id="chat-messages"
        ref={listRef}
        role="log"
        aria-live="polite"
        aria-label={t("messages")}
        className="hidden min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-[18px] pt-1.5 pb-[18px] group-data-[dragging=true]:flex group-data-[expanded=true]:flex md:flex"
      >
        <div className="flex max-w-[92%] flex-col gap-3 self-start rounded-[18px] rounded-bl-[4px] bg-card p-4 text-card-foreground">
          <p className="text-[15px] leading-normal text-pretty">{t("greet")}</p>
          {msgs.length === 0 && (
            <ul aria-label={t("suggestionsLabel")} className="flex flex-col gap-1.5">
              {suggestions.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => send(s)}
                    className="w-full rounded-xl border-[1.5px] border-[oklch(0.88_0.04_27)] bg-[oklch(0.98_0.01_27)] px-3 py-2.5 text-left text-sm font-medium text-primary-strong hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {msgs.map((m) =>
          m.role === "user" ? (
            <p key={m.id} className="max-w-[85%] self-end rounded-[18px] rounded-br-[4px] bg-primary-strong px-4 py-3 text-[15px] leading-normal">
              {m.text}
            </p>
          ) : (
            <p key={m.id} className="max-w-[92%] self-start rounded-[18px] rounded-bl-[4px] bg-card p-4 text-[15px] leading-normal text-card-foreground">
              {m.text}
            </p>
          ),
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex flex-col gap-2.5 border-t border-white/20 px-[18px] pt-3 pb-[max(16px,env(safe-area-inset-bottom))]"
      >
        <div className="flex items-center gap-2 rounded-2xl bg-card py-1.5 pr-1.5 pl-4">
          <label htmlFor="chat-input" className="sr-only">
            {t("inputLabel")}
          </label>
          <input
            id="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("inputPlaceholder")}
            autoComplete="off"
            className="h-10 min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none"
          />
          <button
            type="submit"
            className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {t("send")}
          </button>
        </div>
        <p className="hidden text-xs leading-snug text-on-primary-muted group-data-[expanded=true]:block md:block">{t("note")}</p>
      </form>
    </aside>
  );
});
