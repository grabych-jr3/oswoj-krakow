// Agent eval (PLAN.md B6): runs every case in cases.json against the real model and checks
// which tools were called and which sources the answer is built on. Writes results.json and report.md.
//
// Run from app/:  npx tsx --env-file=.env.local ../evals/run.ts [--only=id1,id2] [--failed] [--missing] [--delay=8000]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { runAgent } from "../app/src/server/agent/agent";
import { normalizeSymbol } from "../app/src/server/agent/kb/procedures";
import { createAgentModel } from "../app/src/server/agent/model";
import { geo } from "../app/src/server/geo";

interface Case {
  id: string;
  locale: "pl" | "uk" | "en";
  question: string;
  expect: {
    tools: string[];
    noTools?: boolean;
    symbols?: string[];
    scenario?: string;
    categories?: string[];
    mode?: "walk" | "transit";
    links?: string[];
  };
}

interface Call {
  tool: string;
  input: Record<string, unknown>;
  error?: string;
}

interface Result {
  id: string;
  locale: string;
  toolsOk: boolean;
  sourcesOk: boolean;
  passed: boolean;
  problems: string[];
  calls: Call[];
  text: string;
  model: string;
  ms: number;
}

const DIR = resolve(import.meta.dirname);
const RESULTS = resolve(DIR, "results.json");
const BIP_LINK = /bip\.krakow\.pl\/uslugi\/([A-Za-z]+-\d+)/g;

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);
const delayMs = Number(args.delay ?? 8000);

/** Symbols the tools actually returned in this run: the only ones the answer may link. */
function returnedSymbols(steps: Awaited<ReturnType<typeof runAgent>["steps"]>): Set<string> {
  const symbols = new Set<string>();
  for (const step of steps) {
    for (const r of step.toolResults) {
      const out = r.output as Record<string, any>;
      out?.hits?.forEach((h: { symbol: string }) => symbols.add(h.symbol));
      if (out?.procedure) symbols.add(out.procedure.symbol);
      out?.scenario?.steps?.forEach((s: { procedureSymbols: string[] }) =>
        s.procedureSymbols.forEach((x) => symbols.add(x)),
      );
    }
  }
  return symbols;
}

function score(c: Case, calls: Call[], text: string, returned: Set<string>): Omit<Result, "id" | "locale" | "calls" | "text" | "model" | "ms"> {
  const problems: string[] = [];
  const called = new Set(calls.map((x) => x.tool));
  const inputsOf = (tool: string) => calls.filter((x) => x.tool === tool).map((x) => x.input);

  let toolsOk = c.expect.tools.every((t) => called.has(t));
  if (!toolsOk) problems.push(`missing tools: ${c.expect.tools.filter((t) => !called.has(t)).join(", ")}`);
  if (c.expect.noTools && called.size > 0) {
    toolsOk = false;
    problems.push(`expected no tools, got ${[...called].join(", ")}`);
  }

  // A stream cut by a quota error still has the right tool calls but no answer.
  if (!text.trim()) {
    toolsOk = false;
    problems.push("empty answer");
  }

  let sourcesOk = true;
  const fail = (msg: string) => {
    sourcesOk = false;
    problems.push(msg);
  };
  if (c.expect.symbols) {
    const fetched = inputsOf("get_procedure").map((i) => normalizeSymbol(String(i.symbol)));
    if (!c.expect.symbols.some((s) => fetched.includes(s))) {
      fail(`expected one of ${c.expect.symbols.join("/")}, fetched ${fetched.join(", ") || "nothing"}`);
    }
  }
  if (c.expect.scenario && !inputsOf("get_scenario").some((i) => i.id === c.expect.scenario)) {
    fail(`expected scenario ${c.expect.scenario}, got ${inputsOf("get_scenario").map((i) => i.id).join(", ") || "none"}`);
  }
  if (c.expect.categories) {
    const cats = inputsOf("find_places").flatMap((i) => (i.categories as string[]) ?? []);
    if (!c.expect.categories.every((x) => cats.includes(x))) fail(`expected categories ${c.expect.categories}, got ${cats}`);
  }
  if (c.expect.mode && !inputsOf("nearby_15min").some((i) => (i.mode ?? "walk") === c.expect.mode)) {
    fail(`expected nearby mode ${c.expect.mode}`);
  }
  for (const link of c.expect.links ?? []) if (!text.includes(link)) fail(`answer lacks link ${link}`);
  // PLAN.md §2.4: every answer about a procedure links its BIP card.
  if ((c.expect.symbols || c.expect.scenario) && !BIP_LINK.test(text)) fail("answer lacks a BIP link");
  BIP_LINK.lastIndex = 0;

  // A BIP link to a card no tool returned is an invented source.
  const invented = [...text.matchAll(BIP_LINK)].map((m) => m[1]).filter((s) => !returned.has(s));
  if (invented.length) fail(`invented BIP links: ${[...new Set(invented)].join(", ")}`);

  return { toolsOk, sourcesOk, passed: toolsOk && sourcesOk, problems };
}

async function runCase(c: Case, model: NonNullable<ReturnType<typeof createAgentModel>>): Promise<Result> {
  const started = Date.now();
  const result = runAgent({ model, geo, locale: c.locale, origin: null, messages: [{ role: "user", content: c.question }] });
  const text = await result.text;
  const steps = await result.steps;
  const calls: Call[] = steps.flatMap((s) =>
    s.content.flatMap((part): Call[] => {
      if (part.type === "tool-call") return [{ tool: part.toolName, input: part.input as Record<string, unknown> }];
      if (part.type === "tool-error") return [{ tool: part.toolName, input: part.input as Record<string, unknown>, error: String(part.error) }];
      return [];
    }),
  );
  // tool-call and tool-error both describe a failed call; keep one entry per call.
  const unique = calls.filter((x, i) => x.error || !calls.some((y, j) => j !== i && y.error && y.tool === x.tool && JSON.stringify(y.input) === JSON.stringify(x.input)));
  return { id: c.id, locale: c.locale, ...score(c, unique, text, returnedSymbols(steps)), calls: unique, text, model: steps.map((s) => s.response.modelId).join(" → "), ms: Date.now() - started };
}

function report(results: Result[]): string {
  const pct = (n: number) => `${Math.round((n / results.length) * 100)}%`;
  const count = (f: (r: Result) => boolean) => results.filter(f).length;
  const byLocale = (["pl", "uk", "en"] as const)
    .map((l) => {
      const rs = results.filter((r) => r.locale === l);
      return `| ${l} | ${rs.length} | ${rs.filter((r) => r.passed).length} |`;
    })
    .join("\n");
  const failures = results
    .filter((r) => !r.passed)
    .map((r) => `### ${r.id}\n- ${r.problems.join("\n- ")}\n- model: ${r.model}
- calls: ${r.calls.map((c) => `${c.tool}(${JSON.stringify(c.input)})${c.error ? " ERR" : ""}`).join(", ") || "none"}`)
    .join("\n\n");
  return `# Agent eval report

Generated ${new Date().toISOString()} · model chain from env · GEO_IMPL=${process.env.GEO_IMPL ?? "real"}

| Metric | Score |
|---|---|
| **Passed (tools and sources)** | **${count((r) => r.passed)}/${results.length} (${pct(count((r) => r.passed))})** |
| Right tools | ${count((r) => r.toolsOk)}/${results.length} (${pct(count((r) => r.toolsOk))}) |
| Right sources | ${count((r) => r.sourcesOk)}/${results.length} (${pct(count((r) => r.sourcesOk))}) |

Target (PLAN.md B6): ≥85% passed.

| Locale | Cases | Passed |
|---|---|---|
${byLocale}

## Failures

${failures || "None."}
`;
}

async function main() {
  const model = createAgentModel();
  if (!model) throw new Error("No LLM provider key in env: run with --env-file=.env.local");

  const cases: Case[] = JSON.parse(readFileSync(resolve(DIR, "cases.json"), "utf8"));
  const previous: Result[] = existsSync(RESULTS) ? JSON.parse(readFileSync(RESULTS, "utf8")) : [];
  const only = args.only?.split(",");
  const failedIds = new Set(previous.filter((r) => !r.passed).map((r) => r.id));
  const done = new Set(previous.map((r) => r.id));
  const todo = cases.filter((c) =>
    only ? only.includes(c.id) : args.failed ? failedIds.has(c.id) : args.missing ? !done.has(c.id) : true,
  );

  const results = new Map(previous.map((r) => [r.id, r]));
  for (const [i, c] of todo.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, delayMs));
    try {
      const r = await runCase(c, model);
      results.set(c.id, r);
      console.log(`${r.passed ? "PASS" : "FAIL"} ${c.id} (${r.ms} ms, ${r.model})${r.passed ? "" : ` — ${r.problems.join("; ")}`}`);
    } catch (error) {
      console.log(`ERROR ${c.id}: ${error instanceof Error ? error.message : error}`);
    }
    writeFileSync(RESULTS, JSON.stringify([...results.values()], null, 2));
  }

  // The report covers the current case list only.
  const current = cases.flatMap((c) => results.get(c.id) ?? []);
  writeFileSync(resolve(DIR, "report.md"), report(current));
  console.log(`\n${current.filter((r) => r.passed).length}/${current.length} passed (${cases.length} cases)`);
}

main();
