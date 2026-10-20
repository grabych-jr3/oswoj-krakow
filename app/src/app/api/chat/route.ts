import { convertToModelMessages, createUIMessageStreamResponse, type UIMessage } from "ai";
import { NextRequest, NextResponse } from "next/server";
import { ChatRequestBody } from "@/contracts/chat";
import { runAgent } from "@/server/agent/agent";
import { cachedAnswer, recordAnswer } from "@/server/agent/answer-cache";
import { mockChatStream } from "@/server/agent/mock-stream";
import { createAgentModel } from "@/server/agent/model";
import { checkRateLimit, clientIp } from "@/server/agent/rate-limit";
import { matchStarter } from "@/server/agent/starters";
import { buildTools } from "@/server/agent/tools";
import { geo } from "@/server/geo";

export const maxDuration = 60;

function lastUserText(messages: UIMessage[]): string {
  const last = messages.findLast((m) => m.role === "user");
  return (last?.parts ?? [])
    .flatMap((p) => (p.type === "text" ? [p.text] : []))
    .join(" ");
}

export async function POST(req: NextRequest) {
  const parsed = ChatRequestBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body", details: parsed.error.format() }, { status: 400 });
  }
  const { locale, map } = parsed.data;
  const messages = parsed.data.messages as UIMessage[];
  const question = lastUserText(messages);

  const model = process.env.LLM_MOCK === "1" ? null : createAgentModel();
  if (!model) return createUIMessageStreamResponse({ stream: mockChatStream(question, locale) });

  // Only a starter that opens the conversation has a reusable answer: later turns depend on context.
  const starterId = messages.length === 1 ? matchStarter(locale, question) : null;
  const cacheKey = starterId && `${locale}:${starterId}:${map?.origin?.label ?? ""}`;
  const cached = cacheKey ? cachedAnswer(cacheKey) : null;
  if (cached) return createUIMessageStreamResponse({ stream: cached });

  const retryAfter = checkRateLimit(clientIp(req.headers));
  if (retryAfter > 0) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const origin = map?.origin ?? null;
  const tools = buildTools({ geo, locale, mapOrigin: origin?.coords ?? null });
  const result = runAgent({
    model,
    geo,
    locale,
    origin,
    messages: await convertToModelMessages(messages, { tools, ignoreIncompleteToolCalls: true }),
  });

  const stream = result.toUIMessageStream({
    onError: (error) => {
      console.error("[chat] stream error", error);
      return "The assistant is temporarily unavailable. Please try again in a moment.";
    },
  });
  return createUIMessageStreamResponse({ stream: cacheKey ? recordAnswer(cacheKey, stream) : stream });
}
