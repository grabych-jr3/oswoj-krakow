// LLM_MOCK=1 (PLAN.md §5.4): a scripted stream with tool parts from the contract fixtures, so the UI (zone C)
// can be built without API keys or quotas.
import { createUIMessageStream } from "ai";
import type { Locale } from "@/contracts/common";
import placesFixture from "@/contracts/fixtures/places.sample.json";
import sa34Fixture from "@/contracts/fixtures/procedure.SA-34.json";
import type { Procedure } from "@/contracts/kb";
import type { Place } from "@/contracts/place";

const INTRO: Record<Locale, string> = {
  pl: "Oto oficjalne informacje dotyczące procedury oraz lokalizacji punktów obsługi mieszkańców w Krakowie:",
  uk: "Ось офіційна інформація щодо процедури та пунктів обслуговування мешканців у Кракові:",
  en: "Here is the official information regarding the procedure and customer service locations in Kraków:",
};

const GREETING: Record<Locale, string> = {
  pl: "Witaj! Jestem asystentem miejskim Krakowa. Możesz zapytać o PESEL, zameldowanie, szkoły lub rejestrację pojazdów.",
  uk: "Вітаю! Я міський асистент Кракова. Ви можете запитати про оформлення PESEL, прописку, школи чи реєстрацію авто.",
  en: "Welcome! I am Kraków's municipal assistant. You can ask about PESEL, residence registration, schools, or vehicle registration.",
};

export function mockChatStream(queryText: string, locale: Locale) {
  const lower = queryText.toLowerCase();
  const isPeselOrMeldunek = lower.includes("pesel") || lower.includes("meldun") || lower.includes("zameldow");

  return createUIMessageStream({
    execute: ({ writer }) => {
      if (!isPeselOrMeldunek) {
        writer.write({ type: "text-start", id: "text-default-1" });
        writer.write({ type: "text-delta", id: "text-default-1", delta: GREETING[locale] });
        writer.write({ type: "text-end", id: "text-default-1" });
        return;
      }

      writer.write({ type: "text-start", id: "text-msg-1" });
      writer.write({ type: "text-delta", id: "text-msg-1", delta: INTRO[locale] });
      writer.write({ type: "text-end", id: "text-msg-1" });

      writer.write({
        type: "tool-input-available",
        toolCallId: "call_get_procedure_sa34",
        toolName: "get_procedure",
        input: { symbol: "SA-34" },
      });
      writer.write({
        type: "tool-output-available",
        toolCallId: "call_get_procedure_sa34",
        output: { procedure: sa34Fixture as Procedure },
      });

      const places = (placesFixture as Place[])
        .filter((p) => p.category === "urzad")
        .map((p, i) => ({ ...p, distanceM: null, label: String(i + 1) }));
      writer.write({
        type: "tool-input-available",
        toolCallId: "call_find_places_urzad",
        toolName: "find_places",
        input: { categories: ["urzad"] },
      });
      writer.write({
        type: "tool-output-available",
        toolCallId: "call_find_places_urzad",
        output: { center: [19.9449799, 50.0646501], places },
      });
    },
  });
}
