// Cache of full answers to starter questions (PLAN.md S5): the demo questions are asked most often,
// so replaying a recorded stream saves LLM quota and keeps the demo working when the provider is down.
import type { UIMessageChunk } from "ai";

const TTL_MS = 6 * 60 * 60 * 1000;

const answers = new Map<string, { chunks: UIMessageChunk[]; storedAt: number }>();

export function cachedAnswer(key: string, now = Date.now()): ReadableStream<UIMessageChunk> | null {
  const entry = answers.get(key);
  if (!entry || now - entry.storedAt > TTL_MS) return null;
  return new ReadableStream({
    start(controller) {
      for (const chunk of entry.chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

/** Passes the stream through and stores it once it ends without an error. */
export function recordAnswer(key: string, stream: ReadableStream<UIMessageChunk>): ReadableStream<UIMessageChunk> {
  const [forClient, forCache] = stream.tee();
  void (async () => {
    const chunks: UIMessageChunk[] = [];
    const reader = forCache.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value.type === "error" || value.type === "abort") return;
      chunks.push(value);
    }
    answers.set(key, { chunks, storedAt: Date.now() });
  })().catch(() => undefined);
  return forClient;
}

export function clearAnswerCache(): void {
  answers.clear();
}
