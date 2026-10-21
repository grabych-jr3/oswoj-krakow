import { describe, expect, it } from "vitest";
import { ToolOutputs } from "@/contracts/chat";
import { normalizePl, toSnippet } from "./normalize";
import { getProcedure, normalizeSymbol, searchProcedures } from "./procedures";
import { getScenario, listScenarioIds } from "./scenarios";

const topSymbols = (query: string, n = 3) =>
  searchProcedures(query).slice(0, n).map((hit) => hit.symbol);

describe("normalizePl", () => {
  it("folds Polish diacritics", () => {
    expect(normalizePl("Zażółć GĘŚLĄ jaźń")).toBe("zazolc gesla jazn");
  });
});

describe("toSnippet", () => {
  it("strips Markdown and cuts at a word boundary", () => {
    const snippet = toSnippet("## Opis\n\n**Wypełnij** [formularz](https://x.pl) " + "słowo ".repeat(60), 50);
    expect(snippet.startsWith("Opis Wypełnij formularz")).toBe(true);
    expect(snippet.endsWith("…")).toBe(true);
    expect(snippet.length).toBeLessThanOrEqual(51);
  });
});

describe("searchProcedures", () => {
  it.each([
    ["zameldowanie na pobyt stały", "SA-14"],
    ["zameldowanie cudzoziemca", "SA-12"],
    ["PESEL obywatel Ukrainy UKR", "SA-65"],
    ["nadanie numeru PESEL", "SA-34"],
    ["rejestracja pojazdu sprowadzonego z zagranicy", "KM-14"],
    ["integracja cudzoziemców", "MOPS-21"],
  ])("%s → %s in top 3", (query, symbol) => {
    expect(topSymbols(query)).toContain(symbol);
  });

  it("finds a procedure by its symbol", () => {
    expect(topSymbols("SA-34", 1)).toEqual(["SA-34"]);
  });

  it("matches queries written without diacritics", () => {
    expect(topSymbols("zameldowanie na pobyt staly")).toContain("SA-14");
  });

  it("filters by tags", () => {
    const hits = searchProcedures("rejestracja", { tags: ["praca"] });
    expect(hits.length).toBeGreaterThan(0);
    for (const hit of hits) expect(getProcedure(hit.symbol)!.tags).toContain("praca");
  });

  it("returns at most 8 hits shaped as the search_procedures tool output", () => {
    const hits = searchProcedures("wniosek");
    expect(hits.length).toBeLessThanOrEqual(8);
    expect(() => ToolOutputs.search_procedures.parse({ hits })).not.toThrow();
  });

  it("returns nothing for an empty query", () => {
    expect(searchProcedures("   ")).toEqual([]);
  });
});

describe("getProcedure", () => {
  it.each(["SA-34", "sa-34", "sa 34", "SA34", " sa_34 "])("resolves %j", (symbol) => {
    expect(getProcedure(symbol)?.symbol).toBe("SA-34");
  });

  it("returns null for an unknown symbol", () => {
    expect(getProcedure("XX-999")).toBeNull();
    expect(normalizeSymbol("xx-999")).toBe("XX-999");
  });
});

describe("getScenario", () => {
  it("has the same scenario ids in every locale", () => {
    expect(listScenarioIds("uk")).toEqual(listScenarioIds("pl"));
    expect(listScenarioIds("en")).toEqual(listScenarioIds("pl"));
  });

  it("returns the scenario in the requested locale", () => {
    expect(getScenario("obywatel-ua", "uk")?.locale).toBe("uk");
  });

  it("returns null for an unknown id", () => {
    expect(getScenario("nie-istnieje", "en")).toBeNull();
  });
});

// Polish queries the model actually sent in eval runs (evals/), plus canonical ones for the remaining cases.
// The model reads the top 5 hits, so the right card must be among them.
const MODEL_HITS = 5;
type LifeTag = NonNullable<NonNullable<Parameters<typeof searchProcedures>[1]>["tags"]>[number];
const EVAL_QUERIES: [query: string, tags: LifeTag[], expected: string[]][] = [
  ["PESEL", [], ["SA-34", "SA-65"]],
  ["zameldowanie na pobyt stały", ["przeprowadzka"], ["SA-14", "SA-12", "SA-32"]],
  ["zameldowanie", ["cudzoziemiec"], ["SA-12"]],
  ["zameldowanie w Krakowie", ["przeprowadzka"], ["SA-14", "SA-32"]],
  ["wymeldowanie", ["przeprowadzka"], ["SA-15", "SA-13"]],
  ["PESEL", ["obywatel_ua"], ["SA-65"]],
  ["nadanie numeru PESEL cudzoziemcowi", ["cudzoziemiec"], ["SA-34"]],
  ["dowód osobisty", [], ["SA-10"]],
  ["utrata dowodu osobistego", [], ["SA-11"]],
  ["rejestracja nowego samochodu", ["pojazd"], ["KM-1"]],
  ["rejestracja samochodu sprowadzonego z Niemiec", ["pojazd"], ["KM-14"]],
  ["wyrejestrowanie samochodu", [], ["KM-7"]],
  ["zmiana adresu w dowodzie rejestracyjnym", [], ["KM-8"]],
  ["wymiana zagranicznego prawa jazdy", [], ["KM-19"]],
  ["profil kandydata na kierowcę", [], ["KM-21"]],
  ["międzynarodowe prawo jazdy", [], ["KM-20"]],
  ["abonament parkingowy mieszkańca", [], ["ZDMK-72", "ZDMK-71"]],
  ["deklaracja opłata za odpady", [], ["PD-17"]],
  ["podatek od nieruchomości", [], ["PD-4"]],
  ["rejestracja urodzenia dziecka", [], ["SC-1", "SC-29"]],
  ["Karta Dużej Rodziny", [], ["SO-27", "SO-28"]],
  ["dodatek mieszkaniowy", [], ["SO-15"]],
  ["rejestracja osoby bezrobotnej", [], ["GUP-2", "GUP-1"]],
  ["integracja cudzoziemców", [], ["MOPS-21"]],
  ["oświadczenie o powierzeniu pracy cudzoziemcowi", [], ["GUP-5"]],
];

describe("searchProcedures on eval queries", () => {
  it.each(EVAL_QUERIES)("%s %j finds one of %j in the top hits", (query, tags, expected) => {
    const top = searchProcedures(query, { tags }).slice(0, MODEL_HITS).map((h) => h.symbol);
    expect(top.some((s) => expected.includes(s))).toBe(true);
  });
});
