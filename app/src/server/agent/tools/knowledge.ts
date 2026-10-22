// Handlers of the knowledge tools: search_procedures, get_procedure, get_scenario.
import type { z } from "zod";
import type { ToolOutputs } from "@/contracts/chat";
import type { Locale } from "@/contracts/common";
import type { LifeTag } from "@/contracts/kb";
import type { GeoService } from "@/server/geo";
import { getProcedure, searchProcedures } from "../kb/procedures";
import { getScenario } from "../kb/scenarios";
import { ToolError } from "./errors";

type Output<Name extends keyof typeof ToolOutputs> = z.infer<(typeof ToolOutputs)[Name]>;

export function runSearchProcedures(input: {
  query_pl: string;
  tags?: z.infer<typeof LifeTag>[];
}): Output<"search_procedures"> {
  return { hits: searchProcedures(input.query_pl, { tags: input.tags }) };
}

/** The procedure card with every office's coords taken from the "urzad" layer of zone A. */
export async function runGetProcedure(
  input: { symbol: string },
  geo: Pick<GeoService, "getPlace">,
): Promise<Output<"get_procedure">> {
  const procedure = getProcedure(input.symbol);
  if (!procedure) {
    throw new ToolError(`Unknown procedure symbol "${input.symbol}". Use search_procedures to find the right one.`);
  }
  const offices = await Promise.all(
    procedure.offices.map(async (office) => {
      // A missing or failed lookup keeps coords null: the card is still useful without a marker.
      const place = await geo.getPlace(office.id).catch(() => null);
      return { ...office, coords: place?.coords ?? null };
    }),
  );
  return { procedure: { ...procedure, offices } };
}

export function runGetScenario(input: { id: string; locale?: Locale }, defaultLocale: Locale): Output<"get_scenario"> {
  const scenario = getScenario(input.id, input.locale ?? defaultLocale);
  if (!scenario) throw new ToolError(`Unknown scenario id "${input.id}".`);
  return { scenario };
}

// The model reads a compact view of tool outputs; the UI still gets the full contract output.
// Each answer is several steps that resend the whole context, so this keeps a reply within
// small per-minute token quotas (Groq free tier: 8000 TPM).
const MODEL_HITS = 5;
const SNIPPET_CHARS = 120;
const SECTION_CHARS = 700;

const clip = (text: string | null, max: number) =>
  text && text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;

export function searchForModel(output: Output<"search_procedures">) {
  return {
    hits: output.hits.slice(0, MODEL_HITS).map((h) => ({ ...h, snippet: clip(h.snippet, SNIPPET_CHARS) })),
  };
}

/**
 * Fee table rows as "title: amount zł". The "Opłaty" section opens with long prose (proxies, IBAN, cash desks),
 * so clipping it by length cut off the amounts and the model quoted the wrong fee.
 */
export function feeRows(oplaty: string | null): string[] {
  if (!oplaty) return [];
  return oplaty
    .split("\n")
    .filter((line) => line.startsWith("|") && !/^\|\s*-/.test(line))
    .slice(1)
    .map((line) => line.split("|").map((cell) => cell.trim()))
    .filter(([, title, amount]) => title && amount)
    .map(([, title, amount]) => `${title}: ${amount} zł`);
}

/** Facts the answer may state (documents, fees, deadlines, where to go); legal basis and attachments stay in the card. */
export function procedureForModel({ procedure: p }: Output<"get_procedure">) {
  const s = p.sections;
  return {
    symbol: p.symbol,
    title: p.title,
    bipUrl: p.bipUrl,
    kogoDotyczy: clip(s.kogoDotyczy, SECTION_CHARS),
    dokumenty: clip(s.dokumenty, SECTION_CHARS * 2),
    fees: feeRows(s.oplaty),
    oplatyNotes: clip(s.oplaty?.split("\n|")[0] ?? null, SECTION_CHARS),
    termin: clip(s.termin, SECTION_CHARS),
    sposob: clip(s.sposob, SECTION_CHARS),
    offices: p.offices.map((o) => ({ name: o.name, address: o.address, hours: o.hours, bookingUrl: o.bookingUrl })),
  };
}

/**
 * What the model sees for get_scenario: the contract output plus the real title and BIP link of every
 * referenced procedure, so the answer quotes them instead of inventing or translating titles.
 */
export function scenarioForModel(output: Output<"get_scenario">) {
  const symbols = [...new Set(output.scenario.steps.flatMap((s) => s.procedureSymbols))];
  const procedures = symbols.flatMap((symbol) => {
    const p = getProcedure(symbol);
    return p ? [{ symbol: p.symbol, title: p.title, bipUrl: p.bipUrl }] : [];
  });
  return { ...output, procedures };
}
