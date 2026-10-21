"use client";

import { Fragment, type ReactNode } from "react";

/**
 * Small Markdown renderer for assistant answers and BIP card sections: paragraphs, headings, lists,
 * tables, bold/italic, code and http(s) links. No raw HTML is ever rendered. Unfinished syntax while an
 * answer streams simply shows as text. Marker references like "(1)" become buttons when `markers` has them.
 * Leftover HTML from BIP cards (links, bold, list items) is turned into the same syntax first.
 */
export function Markdown({
  text,
  markers,
  onMarker,
  markerLabel,
}: {
  text: string;
  markers?: ReadonlySet<string>;
  onMarker?: (label: string) => void;
  markerLabel?: (label: string) => string;
}) {
  const inline = (s: string) => renderInline(s, { markers, onMarker, markerLabel });
  return <div className="flex flex-col gap-2">{parseBlocks(text).map((b, i) => renderBlock(b, i, inline))}</div>;
}

type Block =
  | { kind: "p"; text: string }
  | { kind: "h"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "table"; head: string[]; rows: string[][] };

const LIST_ITEM = /^\s*(?:[-*+•]|(\d+)[.)])\s+(.*)$/;
const TABLE_SEPARATOR = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());

/** Inline HTML left in some BIP sections → the same Markdown syntax. Any other tag is dropped. */
export function htmlToMarkdown(text: string): string {
  if (!text.includes("<")) return text;
  return text
    .replace(/<a\s[^>]*href="(https?:\/\/[^"]+)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)")
    .replace(/<\/?(strong|b)>/gi, "**")
    .replace(/<li[^>]*>/gi, " • ")
    .replace(/<br\s*\/?>|<\/p>\s*<p[^>]*>/gi, " ")
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .replace(/[ \t]{2,}/g, " ");
}

function parseBlocks(text: string): Block[] {
  const lines = htmlToMarkdown(text).replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ kind: "p", text: para.join(" ") });
    para = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) {
      flush();
      continue;
    }
    const heading = /^\s*#{1,6}\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      blocks.push({ kind: "h", text: heading[1] });
      continue;
    }
    if (line.trim().startsWith("|") && TABLE_SEPARATOR.test(lines[i + 1] ?? "")) {
      flush();
      const head = cells(line);
      const rows: string[][] = [];
      for (i += 2; i < lines.length && lines[i].trim().startsWith("|"); i++) rows.push(cells(lines[i]));
      i--;
      blocks.push({ kind: "table", head, rows });
      continue;
    }
    const item = LIST_ITEM.exec(line);
    if (item) {
      flush();
      const ordered = item[1] !== undefined;
      const last = blocks.at(-1);
      if (last?.kind === "list" && last.ordered === ordered) last.items.push(item[2]);
      else blocks.push({ kind: "list", ordered, items: [item[2]] });
      continue;
    }
    // An indented line right after a list item continues that item.
    const last = blocks.at(-1);
    if (!para.length && last?.kind === "list" && /^\s+/.test(line)) {
      last.items[last.items.length - 1] += ` ${line.trim()}`;
      continue;
    }
    para.push(line.trim());
  }
  flush();
  return blocks;
}

function renderBlock(b: Block, key: number, inline: (s: string) => ReactNode) {
  switch (b.kind) {
    case "p":
      return (
        <p key={key} className="text-pretty">
          {inline(b.text)}
        </p>
      );
    case "h":
      return (
        <p key={key} className="font-bold">
          {inline(b.text)}
        </p>
      );
    case "list": {
      const List = b.ordered ? "ol" : "ul";
      return (
        <List key={key} className={`flex flex-col gap-1 pl-5 ${b.ordered ? "list-decimal" : "list-disc"} marker:text-primary`}>
          {b.items.map((it, i) => (
            <li key={i}>{inline(it)}</li>
          ))}
        </List>
      );
    }
    case "table":
      return (
        <div key={key} className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-muted">
              <tr>
                {b.head.map((h, i) => (
                  <th key={i} className="px-2 py-1.5 font-semibold">
                    {inline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((r, i) => (
                <tr key={i} className="border-t border-border">
                  {r.map((c, j) => (
                    <td key={j} className="px-2 py-1.5 align-top">
                      {inline(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

type InlineOpts = {
  markers?: ReadonlySet<string>;
  onMarker?: (label: string) => void;
  markerLabel?: (label: string) => string;
};

// Order matters: links before bare URLs, bold before italic.
const INLINE =
  /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|\*\*(.+?)\*\*|__(.+?)__|(?<![*\w])\*(?!\s)([^*]+?)\*(?!\*)|`([^`]+)`|\((\d{1,2})\)|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?])/g;

function renderInline(text: string, opts: InlineOpts): ReactNode {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    const start = m.index;
    if (start > last) out.push(text.slice(last, start));
    const k = out.length;
    const [whole, linkText, linkUrl, bold1, bold2, italic, code, marker, bare] = m;
    if (linkUrl) out.push(<ExternalA key={k} href={linkUrl}>{renderInline(linkText, opts)}</ExternalA>);
    else if (bold1 ?? bold2) out.push(<strong key={k}>{renderInline((bold1 ?? bold2)!, opts)}</strong>);
    else if (italic) out.push(<em key={k}>{renderInline(italic, opts)}</em>);
    else if (code) out.push(<code key={k} className="rounded bg-muted px-1 font-mono text-[0.9em]">{code}</code>);
    else if (marker && opts.markers?.has(marker) && opts.onMarker) {
      const label = marker;
      out.push(
        <button
          key={k}
          type="button"
          onClick={() => opts.onMarker!(label)}
          aria-label={opts.markerLabel?.(label)}
          className="mx-0.5 inline-grid size-5 -translate-y-px place-items-center rounded-full bg-primary align-middle text-[11px] font-bold text-primary-foreground hover:bg-primary-strong focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
        >
          {label}
        </button>,
      );
    } else if (bare) out.push(<ExternalA key={k} href={bare}>{bare}</ExternalA>);
    else out.push(whole);
    last = start + whole.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.map((n, i) => (typeof n === "string" ? <Fragment key={`t${i}`}>{n}</Fragment> : n));
}

function ExternalA({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="font-medium break-words text-primary-strong underline underline-offset-2 hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
    >
      {children}
    </a>
  );
}
