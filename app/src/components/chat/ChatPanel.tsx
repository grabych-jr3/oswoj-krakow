"use client";

import type { UIMessage } from "ai";
import { AlertCircle, ChevronUp, LoaderCircle, RotateCcw, Square } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { Locale } from "@/contracts/common";
import { parseToolPart } from "@/lib/toolParts";
import { cn } from "@/lib/utils";
import { messageMarkers } from "@/map/chatMap";
import { getStarters } from "@/server/agent/starters";
import { useSheetAnimation } from "@/components/shell/useSheetAnimation";
import { useChatActions } from "./ChatActions";
import { Markdown } from "./Markdown";
import { ToolPart } from "./ToolPart";
import type { Assistant } from "./useAssistant";

type Props = {
  assistant: Assistant;
  /** Mobile bottom sheet state; on md+ the panel is always fully open. */
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  /** Phones: hide the sheet while another bottom sheet (the 15-minute panel) takes its place. */
  phoneHidden?: boolean;
};

/** Chat with the assistant (C3): streamed answers, tool cards and links to the map. */
export const ChatPanel = forwardRef<HTMLElement, Props>(function ChatPanel({ assistant, expanded, onExpandedChange, phoneHidden = false }, ref) {
  const t = useTranslations("Chat");
  const locale = useLocale() as Locale;
  const { messages, status, error, busy, rateLimited } = assistant;
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  // A new question scrolls to the top of the list, so its answer reads from the beginning
  // (cards can be long); errors and the "thinking" bubble at the end stay in view.
  const count = messages.length;
  useEffect(() => {
    const list = listRef.current;
    const question = [...(list?.querySelectorAll<HTMLElement>("[data-user-message]") ?? [])].at(-1);
    if (list && question) list.scrollTo({ top: question.offsetTop - 8, behavior: "smooth" });
  }, [count]);
  useEffect(() => {
    const list = listRef.current;
    if (list && error) list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, [error]);

  function send(text: string) {
    if (busy || !text.trim()) return;
    assistant.ask(text);
    setInput("");
    onExpandedChange(true);
  }

  const starters = getStarters(locale);
  const waiting = status === "submitted" && messages.at(-1)?.role === "user";

  // --- Mobile swipe on the sheet header -------------------------------------------------
  // The sheet stays anchored to the bottom edge and its height follows the finger, so it never
  // detaches from the screen bottom; on release it snaps open or closed.
  const SWIPE_PX = 40; // distance that counts as a swipe
  const MIN_SHEET_PX = 96;
  const drag = useRef<{ startY: number; startH: number; moved: boolean; onHandle: boolean } | null>(null);
  const [dragH, setDragH] = useState<number | null>(null);
  // Open / close glides; a released drag settles from where the finger left the sheet.
  const sheetRef = useRef<HTMLElement>(null);
  useImperativeHandle(ref, () => sheetRef.current as HTMLElement);
  useSheetAnimation(sheetRef, `${expanded}:${dragH === null}`, dragH !== null);

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
      ref={sheetRef}
      aria-label={t("title")}
      data-expanded={expanded}
      data-dragging={dragH !== null}
      style={dragH !== null ? { height: dragH } : undefined}
      className={cn(
        "group fixed inset-x-0 bottom-0 z-20 flex max-h-[85dvh] flex-col overflow-hidden rounded-t-3xl max-md:motion-safe:animate-in max-md:motion-safe:slide-in-from-bottom max-md:motion-safe:[--tw-animation-duration:300ms] bg-primary text-primary-foreground shadow-[0_-12px_40px_-16px_rgb(80_10_10/0.55)]",
        "data-[expanded=true]:h-[85dvh]",
        "md:static md:z-auto md:h-auto md:max-h-none md:w-[30%] md:min-w-[380px] md:shrink-0 md:rounded-none md:shadow-none md:data-[expanded=true]:h-auto",
        phoneHidden && "max-md:hidden",
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
              onClick={assistant.reset}
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
        aria-label={t("messages")}
        aria-busy={busy}
        className="relative hidden min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-[18px] pt-1.5 pb-[18px] group-data-[dragging=true]:flex group-data-[expanded=true]:flex md:flex"
      >
        <div className="flex max-w-[92%] flex-col gap-3 self-start rounded-[18px] rounded-bl-[4px] bg-card p-4 text-card-foreground">
          <p className="text-[15px] leading-normal text-pretty">{t("greet")}</p>
          {messages.length === 0 && (
            <ul aria-label={t("suggestionsLabel")} className="flex flex-col gap-1.5">
              {starters.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => send(s.question)}
                    className="w-full rounded-xl border-[1.5px] border-[oklch(0.88_0.04_27)] bg-[oklch(0.98_0.01_27)] px-3 py-2.5 text-left text-sm font-medium text-primary-strong hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    {s.question}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {messages.map((m) =>
          m.role === "user" ? (
            <p key={m.id} data-user-message className="max-w-[85%] self-end rounded-[18px] rounded-br-[4px] bg-primary-strong px-4 py-3 text-[15px] leading-normal whitespace-pre-wrap">
              {textOf(m)}
            </p>
          ) : (
            <AssistantMessage key={m.id} message={m} />
          ),
        )}

        {waiting && (
          <p role="status" className="flex items-center gap-2 self-start rounded-[18px] rounded-bl-[4px] bg-card px-4 py-3 text-[14px] text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin text-primary" aria-hidden />
            {t("thinking")}
          </p>
        )}

        {error && (
          <div role="alert" className="flex max-w-[92%] flex-col items-start gap-2 self-start rounded-[18px] rounded-bl-[4px] bg-card p-4 text-[14px] text-card-foreground">
            <p className="flex gap-2">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              {rateLimited ? t("rateLimited") : t("error")}
            </p>
            <button
              type="button"
              onClick={assistant.retry}
              className="rounded-lg bg-primary px-3 py-1.5 text-[13px] font-semibold text-primary-foreground hover:bg-primary-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {t("retry")}
            </button>
          </div>
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
            maxLength={500}
            className="h-10 min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none"
          />
          {busy ? (
            <button
              type="button"
              onClick={() => void assistant.stop()}
              className="flex h-10 items-center gap-1.5 rounded-xl bg-primary-strong px-4 text-sm font-semibold text-primary-foreground hover:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <Square className="size-3 fill-current" aria-hidden />
              {t("stop")}
            </button>
          ) : (
            <button
              type="submit"
              className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {t("send")}
            </button>
          )}
        </div>
        <p className="hidden text-xs leading-snug text-on-primary-muted group-data-[expanded=true]:block md:block">{t("note")}</p>
      </form>
    </aside>
  );
});

const textOf = (m: UIMessage) => m.parts.flatMap((p) => (p.type === "text" ? [p.text] : [])).join("\n");

/** One answer: text with clickable marker numbers, and a card per tool result. */
function AssistantMessage({ message }: { message: UIMessage }) {
  const t = useTranslations("Chat");
  const { showPlace } = useChatActions();
  const markers = useMemo(() => messageMarkers(message), [message]);
  const labels = useMemo(() => new Set(markers.keys()), [markers]);

  // A failed tool the agent already explains in its text (e.g. "give a more precise address") needs no error line.
  const hasText = message.parts.some((p) => p.type === "text" && p.text.trim());
  const blocks = message.parts.flatMap((part, i) => {
    if (part.type === "text") {
      if (!part.text.trim()) return [];
      return [
        <div key={i} className="text-[15px] leading-normal">
          <Markdown
            text={part.text}
            markers={labels}
            onMarker={(label) => {
              const place = markers.get(label);
              if (place) showPlace(place);
            }}
            markerLabel={(label) => t("markerLabel", { label })}
          />
        </div>,
      ];
    }
    const tool = parseToolPart(part);
    if (!tool || (tool.state === "error" && hasText)) return [];
    return [<ToolPart key={i} part={tool} />];
  });
  if (!blocks.length) return null;

  return (
    <div className="flex w-full max-w-[96%] flex-col gap-3 self-start rounded-[18px] rounded-bl-[4px] bg-card p-4 text-card-foreground">{blocks}</div>
  );
}
