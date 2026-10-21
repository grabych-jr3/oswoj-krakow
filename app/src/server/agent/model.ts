// LLM provider from env (PLAN.md §4.4) with automatic fallback on 429 / 5xx (PLAN.md §4.3, item 6).
import { google } from "@ai-sdk/google";
import { createGroq, groq } from "@ai-sdk/groq";
import { mistral } from "@ai-sdk/mistral";
import { APICallError, type LanguageModelMiddleware, wrapLanguageModel } from "ai";

type Model = ReturnType<typeof wrapLanguageModel>;
type ProviderName = "google" | "mistral" | "groq" | "infercom";

// Infercom serves an OpenAI-compatible API; the Groq client speaks the same protocol, so no extra package is needed.
const infercom = createGroq({ baseURL: "https://api.infercom.ai/v1", apiKey: process.env.INFERCOM_API_KEY });

const PROVIDERS: Record<ProviderName, { create: (id: string) => Model; keyEnv: string; defaultModel: string }> = {
  google: { create: (id) => google(id), keyEnv: "GOOGLE_GENERATIVE_AI_API_KEY", defaultModel: "gemini-2.5-flash" },
  mistral: { create: (id) => mistral(id), keyEnv: "MISTRAL_API_KEY", defaultModel: "mistral-small-latest" },
  groq: { create: (id) => groq(id), keyEnv: "GROQ_API_KEY", defaultModel: "openai/gpt-oss-120b" },
  infercom: { create: (id) => infercom(id), keyEnv: "INFERCOM_API_KEY", defaultModel: "gpt-oss-120b" },
};
/** Same provider, separate free-tier quota: tried right after a Google primary, otherwise last. */
const GOOGLE_SPARE_MODEL = "gemini-2.5-flash-lite";

export interface ModelChoice {
  provider: ProviderName;
  modelId: string;
}

function isProvider(name: string | undefined): name is ProviderName {
  return name !== undefined && name in PROVIDERS;
}

/** Ordered candidates: configured primary, configured fallback, then a spare Gemini model. Only those with a key. */
export function resolveModelChain(env: Record<string, string | undefined> = process.env): ModelChoice[] {
  const primary: ProviderName = isProvider(env.LLM_PROVIDER) ? env.LLM_PROVIDER : "google";
  // A comma-separated list, e.g. "mistral,groq"; LLM_FALLBACK_MODEL applies to the first one only.
  const fallbacks = (env.LLM_FALLBACK_PROVIDER ?? "").split(",").map((s) => s.trim()).filter(isProvider);
  const spare: ModelChoice = { provider: "google", modelId: GOOGLE_SPARE_MODEL };
  const chain: ModelChoice[] = [
    { provider: primary, modelId: env.LLM_MODEL || PROVIDERS[primary].defaultModel },
    ...(primary === "google" ? [spare] : []),
    ...fallbacks.map((p, i) => ({
      provider: p,
      modelId: (i === 0 && env.LLM_FALLBACK_MODEL) || PROVIDERS[p].defaultModel,
    })),
    spare,
  ];
  const seen = new Set<string>();
  return chain.filter((c) => {
    const key = `${c.provider}:${c.modelId}`;
    if (seen.has(key) || !env[PROVIDERS[c.provider].keyEnv]) return false;
    seen.add(key);
    return true;
  });
}

/** Quota and server errors are worth another provider; bad requests are not. */
export function shouldFallBack(error: unknown): boolean {
  if (!APICallError.isInstance(error)) return false;
  const status = error.statusCode ?? 0;
  return status === 429 || status >= 500 || error.isRetryable;
}

function fallbackMiddleware(fallbacks: Model[]): LanguageModelMiddleware {
  return {
    // Falls back only if the call fails before streaming starts; a stream that broke mid-answer is not replayed.
    wrapStream: async ({ doStream, params }) => {
      try {
        return await doStream();
      } catch (error) {
        let lastError = error;
        for (const model of fallbacks) {
          if (!shouldFallBack(lastError)) break;
          console.warn(`[agent] falling back to ${model.provider}:${model.modelId}`);
          try {
            return await model.doStream(params);
          } catch (next) {
            lastError = next;
          }
        }
        throw lastError;
      }
    },
  };
}

/** The agent's model, or null when no provider has an API key (the route then serves the mock). */
export function createAgentModel(): Model | null {
  const chain = resolveModelChain();
  if (chain.length === 0) return null;
  const [primary, ...rest] = chain.map((c) => PROVIDERS[c.provider].create(c.modelId));
  return rest.length ? wrapLanguageModel({ model: primary, middleware: fallbackMiddleware(rest) }) : primary;
}
