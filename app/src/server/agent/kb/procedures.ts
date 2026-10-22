// In-memory full-text index over BIP procedures (PLAN.md §6.B, B5).
// Built lazily once per server instance; the agent's search_procedures and get_procedure tools read from here.
import MiniSearch from "minisearch";
import type { z } from "zod";
import type { ToolOutputs } from "@/contracts/chat";
import { type LifeTag as LifeTagSchema, Procedure } from "@/contracts/kb";
import proceduresJson from "../../../../data/kb/procedures.json";
import { normalizePl, toSnippet } from "./normalize";

export type ProcedureHit = z.infer<typeof ToolOutputs.search_procedures>["hits"][number];
// The contract exports only the LifeTag schema, so the type is inferred here.
type LifeTag = z.infer<typeof LifeTagSchema>;

// Parsing at load fails fast if procedures.json drifts from the contract.
const procedures: Procedure[] = Procedure.array().parse(proceduresJson);
const bySymbol = new Map(procedures.map((p) => [p.symbol, p]));

const DEFAULT_LIMIT = 8;
/** Floor for the relevance boost, so a niche procedure can still win an exact query. */
const RELEVANCE_FLOOR = 0.3;

interface IndexedDoc {
  id: string;
  symbol: string;
  title: string;
  opis: string;
  kogoDotyczy: string;
  tags: string;
  relevance: number;
  tagList: LifeTag[];
}

/**
 * Everyday or older words people use that BIP cards never contain, mapped to the official terms.
 * Keys are normalized (lower case, no diacritics); the official terms are added to the query.
 */
const QUERY_SYNONYMS: Record<string, string> = {
  // "Umiejscowienie" is the pre-2015 name of transcribing a foreign civil-status record (SC-6).
  umiejscowienie: "transkrypcja zagranicznego dokumentu stanu cywilnego",
  meldunek: "zameldowanie",
  prawko: "prawo jazdy",
  // BIP cards say "pojazd"; people say "samochód".
  samochod: "pojazd",
  // Cards say "odpady komunalne"; people say "śmieci" or "nieczystości".
  smieci: "odpady komunalne",
  nieczystosci: "odpady komunalne",
};

function withSynonyms(queryPl: string): string {
  const extra = normalizePl(queryPl)
    .split(/\s+/)
    .flatMap((word) => Object.entries(QUERY_SYNONYMS).filter(([key]) => word.startsWith(key)).map(([, terms]) => terms));
  return [queryPl, ...extra].join(" ");
}

let index: MiniSearch<IndexedDoc> | null = null;

function getIndex(): MiniSearch<IndexedDoc> {
  if (index) return index;
  index = new MiniSearch<IndexedDoc>({
    fields: ["symbol", "title", "opis", "kogoDotyczy", "tags"],
    storeFields: ["relevance", "tagList"],
    processTerm: (term) => normalizePl(term) || null,
    searchOptions: {
      boost: { symbol: 5, title: 3, kogoDotyczy: 1.5 },
      prefix: true,
      fuzzy: 0.2,
      combineWith: "OR",
      boostDocument: (_id, _term, stored) => RELEVANCE_FLOOR + Number(stored?.relevance ?? 0),
    },
  });
  index.addAll(
    procedures.map((p) => ({
      id: p.symbol,
      symbol: p.symbol,
      title: p.title,
      opis: p.sections.opis ?? "",
      kogoDotyczy: p.sections.kogoDotyczy ?? "",
      tags: p.tags.join(" "),
      relevance: p.relevance,
      tagList: p.tags,
    })),
  );
  return index;
}

/** Score multiplier for procedures sharing a requested tag. */
const TAG_BOOST = 1.5;

/**
 * Top procedures for a Polish query. `tags` boost matching procedures but do not hide the rest:
 * the model often guesses a tag the right card lacks ("mieszkanie" for zameldowanie), and a hard
 * filter then returned nothing, so the model claimed no such procedure exists.
 */
export function searchProcedures(
  queryPl: string,
  options: { tags?: LifeTag[]; limit?: number } = {},
): ProcedureHit[] {
  const { tags, limit = DEFAULT_LIMIT } = options;
  const results = getIndex().search(withSynonyms(queryPl), {
    boostDocument: (_id, _term, stored) => {
      const base = RELEVANCE_FLOOR + Number(stored?.relevance ?? 0);
      const tagged = tags?.length && (stored?.tagList as LifeTag[] | undefined)?.some((tag) => tags.includes(tag));
      return tagged ? base * TAG_BOOST : base;
    },
  });
  return results.slice(0, limit).map((result) => {
    const procedure = bySymbol.get(String(result.id))!;
    return {
      symbol: procedure.symbol,
      title: procedure.title,
      snippet: toSnippet(procedure.sections.opis ?? procedure.sections.kogoDotyczy),
      bipUrl: procedure.bipUrl,
    };
  });
}

/** Canonical "SA-34" from model-written variants like "sa 34", "SA34", "sa_34". */
export function normalizeSymbol(symbol: string): string {
  const match = symbol.trim().match(/^([a-z]+)[\s_-]*(\d+)$/i);
  return match ? `${match[1].toUpperCase()}-${match[2]}` : symbol.trim().toUpperCase();
}

export function getProcedure(symbol: string): Procedure | null {
  return bySymbol.get(normalizeSymbol(symbol)) ?? null;
}
