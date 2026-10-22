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
    // The last step may not call tools: Gemini then writes an answer (gpt-oss does not, hence the high cap).
    prepareStep: ({ stepNumber }) => (stepNumber === MAX_STEPS - 1 ? { toolChoice: "none" } : undefined),
    temperature: 0.2,
    // One retry on the same model; after that the fallback middleware switches provider.
    maxRetries: 1,
  });
}
