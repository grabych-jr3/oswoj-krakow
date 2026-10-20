import { NextRequest, NextResponse } from "next/server";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { ChatRequestBody } from "@/contracts/chat";
import sa34Fixture from "@/contracts/fixtures/procedure.SA-34.json";
import placesFixture from "@/contracts/fixtures/places.sample.json";
import type { Procedure } from "@/contracts/kb";
import type { Place } from "@/contracts/place";

interface ToolPlace extends Place {
  distanceM: number | null;
  label: string;
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parseResult = ChatRequestBody.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.format() },
        { status: 400 },
      );
    }

    const { messages, locale } = parseResult.data;

    // Check mock mode or absent API key (following PLAN.md §4.4 GOOGLE_GENERATIVE_AI_API_KEY)
    const isMock =
      process.env.LLM_MOCK === "1" || !process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (isMock) {
      // Extract latest message text from content string or parts array
      const lastMsg = messages[messages.length - 1];
      let queryText = "";
      if (lastMsg) {
        if (typeof lastMsg.content === "string") {
          queryText = lastMsg.content;
        } else if (Array.isArray(lastMsg.parts)) {
          queryText = lastMsg.parts
            .filter((p: { type?: string; text?: string }) => p.type === "text" && typeof p.text === "string")
            .map((p: { text: string }) => p.text)
            .join(" ");
        }
      }

      const lower = queryText.toLowerCase();

      // Precise triggers: PESEL or zameldowanie keywords
      const isPeselOrMeldunek =
        lower.includes("pesel") ||
        lower.includes("meldun") ||
        lower.includes("zameldow");

      const stream = createUIMessageStream({
        execute: ({ writer }) => {
          if (isPeselOrMeldunek) {
            // Emitting neutral introductory text based on requested locale
            const introText =
              locale === "uk"
                ? "Ось офіційна інформація щодо процедури та пунктів обслуговування мешканців у Кракові:"
                : locale === "en"
                  ? "Here is the official information regarding the procedure and customer service locations in Kraków:"
                  : "Oto oficjalne informacje dotyczące procedury oraz lokalizacji punktów obsługi mieszkańców w Krakowie:";

            const textId = "text-msg-1";
            writer.write({ type: "text-start", id: textId });
            writer.write({ type: "text-delta", id: textId, delta: introText });
            writer.write({ type: "text-end", id: textId });

            // 1. Tool call get_procedure (procedure.SA-34.json)
            const procedureToolCallId = "call_get_procedure_sa34";
            writer.write({
              type: "tool-input-available",
              toolCallId: procedureToolCallId,
              toolName: "get_procedure",
              input: { symbol: "SA-34" },
            });
            writer.write({
              type: "tool-output-available",
              toolCallId: procedureToolCallId,
              output: { procedure: sa34Fixture as Procedure },
            });

            // 2. Tool call find_places (relevant offices from places fixture)
            const placesToolCallId = "call_find_places_urzad";
            const samplePlaces: ToolPlace[] = (placesFixture as Place[])
              .filter((p) => p.category === "urzad")
              .map((p, idx) => ({
                ...p,
                distanceM: null,
                label: String(idx + 1),
              }));

            writer.write({
              type: "tool-input-available",
              toolCallId: placesToolCallId,
              toolName: "find_places",
              input: { categories: ["urzad"] },
            });
            writer.write({
              type: "tool-output-available",
              toolCallId: placesToolCallId,
              output: {
                center: [19.9449799, 50.0646501],
                places: samplePlaces,
              },
            });
          } else {
            // Neutral assistant greeting
            const greeting =
              locale === "uk"
                ? "Вітаю! Я міський асистент Кракова. Ви можете запитати про оформлення PESEL, прописку, школи чи реєстрацію авто."
                : locale === "en"
                  ? "Welcome! I am Kraków's municipal assistant. You can ask about PESEL, residence registration, schools, or vehicle registration."
                  : "Witaj! Jestem asystentem miejskim Krakowa. Możesz zapytać o PESEL, zameldowanie, szkoły lub rejestrację pojazdów.";

            const defaultTextId = "text-default-1";
            writer.write({ type: "text-start", id: defaultTextId });
            writer.write({ type: "text-delta", id: defaultTextId, delta: greeting });
            writer.write({ type: "text-end", id: defaultTextId });
          }
        },
      });

      return createUIMessageStreamResponse({ stream });
    }

    // Full LLM agent implementation is in task B5
    return NextResponse.json(
      { error: "Real LLM agent is under development (B5). Use LLM_MOCK=1." },
      { status: 501 },
    );
  } catch (error) {
    console.error("Chat API Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
