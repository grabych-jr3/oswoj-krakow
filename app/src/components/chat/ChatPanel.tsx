"use client";

import type { UIMessage } from "ai";
import { AlertCircle, Baby, Car, ChevronLeft, ChevronUp, FileText, House, LoaderCircle, type LucideIcon, MessageCircle, RotateCcw, Square } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { Locale } from "@/contracts/common";
import { parseToolPart } from "@/lib/toolParts";
import { cn } from "@/lib/utils";
import { messageMarkers } from "@/map/chatMap";
import { getStarterTopics, type StarterTopic } from "@/server/agent/starters";
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

  const topics = getStarterTopics(locale);
  // Starter menu: topics first, a topic opens its questions (zone B keeps the list in starters.ts).
  const [topicId, setTopicId] = useState<string | null>(null);
  const topic = topics.find((x) => x.id === topicId) ?? null;
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
  const resize = useChatWidth(sheetRef);

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
        // Desktop: a column over the right side of the map, so resizing it never squeezes the map.
        "md:absolute md:inset-y-0 md:right-0 md:left-auto md:h-auto md:max-h-none md:w-[min(50vw,max(380px,var(--chat-w,30%)))] md:rounded-none md:shadow-[-16px_0_40px_-24px_rgb(80_10_10/0.5)] md:data-[expanded=true]:h-auto",
        phoneHidden && "max-md:hidden",
      )}
    >
      {/* Desktop: drag the left edge to make the chat wider (up to half the screen); double-click resets. */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={t("resize")}
        aria-valuemin={MIN_CHAT_PX}
        aria-valuemax={1}
        aria-valuenow={1}
        tabIndex={0}
        data-chat-resize
        {...resize}
        className="group/rs absolute inset-y-0 left-0 z-30 hidden w-3 cursor-col-resize touch-none focus-visible:outline-none md:block"
      >
        <span className="absolute top-1/2 left-1 h-14 w-1.5 -translate-y-1/2 rounded-full bg-white/70 opacity-0 transition-opacity group-hover/rs:opacity-100 group-focus-visible/rs:opacity-100 group-focus-visible/rs:outline-2 group-focus-visible/rs:outline-white" />
      </div>

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
            <StarterMenu
              topics={topics}
              topic={topic}
              onTopic={setTopicId}
              onAsk={(q) => {
                setTopicId(null);
                send(q);
              }}
            />          )}
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

const TOPIC_ICONS: Record<string, LucideIcon> = { documents: FileText, family: Baby, car: Car, neighbourhood: House };

/** Starter topics; a topic opens into its questions. Free typing stays available below. */
function StarterMenu({
  topics,
  topic,
  onTopic,
  onAsk,
}: {
  topics: StarterTopic[];
  topic: StarterTopic | null;
  onTopic: (id: string | null) => void;
  onAsk: (question: string) => void;
}) {
  const t = useTranslations("Chat");
  const item =
    "flex w-full items-center gap-2.5 rounded-xl border-[1.5px] border-[oklch(0.88_0.04_27)] bg-[oklch(0.98_0.01_27)] px-3 py-2.5 text-left text-sm font-medium text-primary-strong hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-ring";
  if (!topic) {
    return (
      <div className="flex flex-col gap-1.5">
        <p className="text-[13px] font-semibold text-muted-foreground">{t("topicsLabel")}</p>
        <ul aria-label={t("topicsLabel")} className="grid grid-cols-1 gap-1.5 min-[420px]:grid-cols-2">
          {topics.map((x) => {
            const Icon = TOPIC_ICONS[x.id] ?? MessageCircle;
            return (
              <li key={x.id}>
                <button type="button" onClick={() => onTopic(x.id)} className={cn(item, "h-full")}>
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground" aria-hidden>
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1 leading-snug">{x.title}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-muted-foreground">{t("orType")}</p>
      </div>
    );
  }
  const Icon = TOPIC_ICONS[topic.id] ?? MessageCircle;
  return (
    <div className="flex flex-col gap-1.5 motion-safe:animate-in motion-safe:fade-in">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onTopic(null)}
          aria-label={t("backToTopics")}
          title={t("backToTopics")}
          className="grid size-8 shrink-0 place-items-center rounded-lg text-primary-strong hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <Icon className="size-4 shrink-0 text-primary" aria-hidden />
        <p className="min-w-0 flex-1 text-[13px] font-semibold">{topic.title}</p>
      </div>
      <ul aria-label={topic.title} className="flex flex-col gap-1.5">
        {topic.questions.map((q) => (
          <li key={q.id}>
            <button type="button" onClick={() => onAsk(q.question)} className={item}>
              {q.question}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

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

const MIN_CHAT_PX = 380;
const MAX_CHAT_SHARE = 0.5;
const STEP_PX = 32;
const WIDTH_KEY = "ok-chat-width";

/**
 * Desktop chat width: drag or arrow keys on the left edge, 380 px … half the screen, kept per browser.
 * The width lives in a CSS variable on the page container, so dragging never re-renders React.
 */
function useChatWidth(ref: React.RefObject<HTMLElement | null>) {
  const drag = useRef<{ x: number; w: number } | null>(null);

  const apply = useCallback(
    (width: number | null) => {
      const el = ref.current;
      if (!el) return;
      const handle = el.querySelector<HTMLElement>("[data-chat-resize]");
      const max = Math.round(window.innerWidth * MAX_CHAT_SHARE);
      // The variable sits on the page container: the map controls next to the chat follow it too.
      const host = el.parentElement ?? el;
      if (width === null) host.style.removeProperty("--chat-w");
      else host.style.setProperty("--chat-w", `${Math.round(Math.min(max, Math.max(MIN_CHAT_PX, width)))}px`);
      const now = Math.round(el.getBoundingClientRect().width);
      handle?.setAttribute("aria-valuemax", String(max));
      handle?.setAttribute("aria-valuenow", String(now));
      handle?.setAttribute("aria-valuetext", `${Math.round((100 * now) / window.innerWidth)}%`);
    },
    [ref],
  );

  const save = (width: number | null) => {
    try {
      if (width === null) localStorage.removeItem(WIDTH_KEY);
      else localStorage.setItem(WIDTH_KEY, String(Math.round(width)));
    } catch {
      // Storage off: the width simply resets next time.
    }
  };
  const current = () => ref.current?.getBoundingClientRect().width ?? MIN_CHAT_PX;

  // The saved width, re-clamped when the window changes size.
  useEffect(() => {
    const restore = () => {
      let saved: number | null = null;
      try {
        saved = Number(localStorage.getItem(WIDTH_KEY)) || null;
      } catch {
        saved = null;
      }
      apply(saved);
    };
    restore();
    window.addEventListener("resize", restore);
    return () => window.removeEventListener("resize", restore);
  }, [apply]);

  return {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      drag.current = { x: e.clientX, w: current() };
      e.currentTarget.setPointerCapture(e.pointerId);
      document.body.style.userSelect = "none";
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      if (drag.current) apply(drag.current.w + drag.current.x - e.clientX); // dragging left widens
    },
    onPointerUp: () => {
      if (!drag.current) return;
      drag.current = null;
      document.body.style.userSelect = "";
      save(current());
    },
    onDoubleClick: () => {
      apply(null);
      save(null);
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      const w = current();
      const next =
        e.key === "ArrowLeft" ? w + STEP_PX : e.key === "ArrowRight" ? w - STEP_PX : e.key === "Home" ? MIN_CHAT_PX : e.key === "End" ? Infinity : null;
      if (next === null) return;
      e.preventDefault();
      apply(next);
      save(current());
    },
  };
}
