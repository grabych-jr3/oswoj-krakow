// The agent call shared by /api/chat and the eval (evals/run.ts), so both exercise the same configuration.
import { type ModelMessage, stepCountIs, streamText } from "ai";
import type { Locale } from "@/contracts/common";
import type { GeocodeResult } from "@/contracts/geo";
import type { GeoService } from "@/server/geo";
import type { createAgentModel } from "./model";
import { buildSystemPrompt } from "./prompt";
import { buildTools } from "./tools";

/**
 * Room for a scenario, a few cards, places and the answer. gpt-oss returns no text when tools are
 * withheld, so the cap must sit well above what an answer needs rather than force an early stop.
 */
const MAX_STEPS = 10;

/** Calls per answer after which a tool is no longer offered. */
const TOOL_BUDGET: Record<string, number> = { get_procedure: 3, search_procedures: 4 };

export interface AgentRequest {
  model: NonNullable<ReturnType<typeof createAgentModel>>;
  geo: GeoService;
  locale: Locale;
  origin: GeocodeResult | null;
  messages: ModelMessage[];
}

export function runAgent({ model, geo, locale, origin, messages }: AgentRequest) {
  const tools = buildTools({ geo, locale, mapOrigin: origin?.coords ?? null });
  return streamText({
    model,
    system: buildSystemPrompt({ locale, origin }),
    messages,
    tools,
    stopWhen: stepCountIs(MAX_STEPS),
    prepareStep: ({ stepNumber, steps }) => {
      // The last step may not call tools: Gemini then writes an answer (gpt-oss does not, hence the high cap).
      if (stepNumber === MAX_STEPS - 1) return { toolChoice: "none" };
      // The prompt asks for at most 3 cards, but gpt-oss sometimes opens 5 and hits the cap with no answer.
      // Past the budget the tool is simply not offered, so the model answers from what it has.
      const used = (name: string) => steps.flatMap((s) => s.toolCalls).filter((c) => c.toolName === name).length;
      const spent = Object.entries(TOOL_BUDGET).filter(([name, max]) => used(name) >= max).map(([name]) => name);
      if (spent.length === 0) return undefined;
      return { activeTools: (Object.keys(tools) as (keyof typeof tools)[]).filter((name) => !spent.includes(name)) };
    },
    temperature: 0.2,
    // One retry on the same model; after that the fallback middleware switches provider.
    maxRetries: 1,
  });
}
