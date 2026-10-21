import { APICallError, type UIMessageChunk } from "ai";
import { beforeEach, describe, expect, it } from "vitest";
import { cachedAnswer, clearAnswerCache, recordAnswer } from "./answer-cache";
import { resolveModelChain, shouldFallBack } from "./model";
import { buildSystemPrompt } from "./prompt";
import { checkRateLimit, clientIp, resetRateLimit } from "./rate-limit";
import { getStarters, matchStarter } from "./starters";

const apiError = (statusCode: number) =>
  new APICallError({ message: "x", url: "u", requestBodyValues: {}, statusCode, isRetryable: false });

describe("resolveModelChain", () => {
  it("orders primary, spare Gemini, fallbacks and drops providers without a key", () => {
    const chain = resolveModelChain({
      LLM_PROVIDER: "google",
      LLM_FALLBACK_PROVIDER: "mistral",
      GOOGLE_GENERATIVE_AI_API_KEY: "g",
      MISTRAL_API_KEY: "m",
    });
    expect(chain.map((c) => `${c.provider}:${c.modelId}`)).toEqual([
      "google:gemini-2.5-flash",
      "google:gemini-2.5-flash-lite",
      "mistral:mistral-small-latest",
    ]);
    expect(resolveModelChain({ LLM_FALLBACK_PROVIDER: "mistral", GOOGLE_GENERATIVE_AI_API_KEY: "g" })).toHaveLength(2);
  });

  it("accepts several fallback providers", () => {
    const chain = resolveModelChain({
      LLM_FALLBACK_PROVIDER: "mistral, groq",
      GOOGLE_GENERATIVE_AI_API_KEY: "g",
      MISTRAL_API_KEY: "m",
      GROQ_API_KEY: "q",
    });
    expect(chain.map((c) => c.provider)).toEqual(["google", "google", "mistral", "groq"]);
  });

  it("puts the spare Gemini model right after Google when Google is a fallback", () => {
    const chain = resolveModelChain({
      LLM_PROVIDER: "infercom",
      LLM_FALLBACK_PROVIDER: "google,groq",
      INFERCOM_API_KEY: "i",
      GOOGLE_GENERATIVE_AI_API_KEY: "g",
      GROQ_API_KEY: "q",
    });
    expect(chain.map((c) => `${c.provider}:${c.modelId}`)).toEqual([
      "infercom:gpt-oss-120b",
      "google:gemini-2.5-flash",
      "google:gemini-2.5-flash-lite",
      "groq:openai/gpt-oss-120b",
    ]);
  });

  it("honours LLM_MODEL and is empty without keys", () => {
    expect(resolveModelChain({ LLM_MODEL: "gemini-x", GOOGLE_GENERATIVE_AI_API_KEY: "g" })[0].modelId).toBe("gemini-x");
    expect(resolveModelChain({})).toEqual([]);
  });
});

describe("shouldFallBack", () => {
  it("switches provider on quota and server errors only", () => {
    expect(shouldFallBack(apiError(429))).toBe(true);
    expect(shouldFallBack(apiError(503))).toBe(true);
    expect(shouldFallBack(apiError(400))).toBe(false);
    expect(shouldFallBack(new Error("bug"))).toBe(false);
  });
});

describe("rate limit", () => {
  beforeEach(resetRateLimit);

  it("allows `limit` requests per minute per IP, then reports seconds to wait", () => {
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) expect(checkRateLimit("a", 3, t + i)).toBe(0);
    expect(checkRateLimit("a", 3, t + 10)).toBe(60);
    expect(checkRateLimit("b", 3, t + 10)).toBe(0);
    expect(checkRateLimit("a", 3, t + 60_001)).toBe(0);
  });

  it("takes the client IP from the first x-forwarded-for entry", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});

describe("starters", () => {
  it("have the same ids in every locale", () => {
    const ids = (l: "pl" | "uk" | "en") => getStarters(l).map((s) => s.id);
    expect(ids("uk")).toEqual(ids("pl"));
    expect(ids("en")).toEqual(ids("pl"));
  });

  it("match a starter regardless of case and punctuation, and nothing else", () => {
    expect(matchStarter("pl", "gdzie mogę uzyskać pesel i co muszę zabrać")).toBe("pesel");
    expect(matchStarter("pl", "Gdzie mogę uzyskać PESEL?")).toBeNull();
  });
});

describe("answer cache", () => {
  beforeEach(clearAnswerCache);

  const streamOf = (chunks: UIMessageChunk[]) =>
    new ReadableStream<UIMessageChunk>({
      start(c) {
        chunks.forEach((x) => c.enqueue(x));
        c.close();
      },
    });
  const drain = async (s: ReadableStream<UIMessageChunk>) => {
    const out: UIMessageChunk[] = [];
    const reader = s.getReader();
    for (let r = await reader.read(); !r.done; r = await reader.read()) out.push(r.value);
    return out;
  };
  const answer: UIMessageChunk[] = [
    { type: "text-start", id: "1" },
    { type: "text-delta", id: "1", delta: "hi" },
    { type: "text-end", id: "1" },
  ];

  it("replays a recorded answer", async () => {
    expect(await drain(recordAnswer("k", streamOf(answer)))).toEqual(answer);
    await new Promise((r) => setTimeout(r, 0));
    expect(await drain(cachedAnswer("k")!)).toEqual(answer);
  });

  it("does not store an answer that ended in an error", async () => {
    await drain(recordAnswer("k", streamOf([...answer, { type: "error", errorText: "x" }])));
    await new Promise((r) => setTimeout(r, 0));
    expect(cachedAnswer("k")).toBeNull();
  });
});

describe("buildSystemPrompt", () => {
  it("names the reply language, scenario ids and the map point", () => {
    const prompt = buildSystemPrompt({
      locale: "uk",
      origin: { label: "ul. Wielicka 28, Kraków", coords: [19.96, 50.04], district: null, precision: "address" },
    });
    expect(prompt).toContain("Reply in Ukrainian");
    expect(prompt).toContain("obywatel-ua");
    expect(prompt).toContain("ul. Wielicka 28, Kraków");
  });
});
