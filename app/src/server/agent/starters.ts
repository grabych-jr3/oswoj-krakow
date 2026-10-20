// Public entry of zone B for the UI (AGENTS.md rule 2): starter questions shown as chat suggestions.
// They follow the demo scenario (PLAN.md §2.3); answers to them are cached by /api/chat.
import type { Locale } from "@/contracts/common";

export interface Starter {
  id: string;
  question: string;
}

const STARTERS: Record<Locale, Starter[]> = {
  pl: [
    { id: "first-steps-ua", question: "Właśnie przeprowadziłem się do Krakowa z Charkowa z 5-letnią córką. Od czego zacząć?" },
    { id: "pesel", question: "Gdzie mogę uzyskać PESEL i co muszę zabrać?" },
    { id: "15min-wielicka", question: "Wynajmuję mieszkanie przy ul. Wielickiej 28. Co mam w zasięgu 15 minut?" },
    { id: "kindergartens", question: "Które przedszkola w pobliżu są największe?" },
  ],
  uk: [
    { id: "first-steps-ua", question: "Я щойно переїхав до Кракова з Харкова з донькою 5 років. З чого почати?" },
    { id: "pesel", question: "Де можна отримати PESEL і що треба взяти з собою?" },
    { id: "15min-wielicka", question: "Я винаймаю квартиру на вул. Wielicka 28. Що є в межах 15 хвилин?" },
    { id: "kindergartens", question: "Які садочки поблизу найбільші?" },
  ],
  en: [
    { id: "first-steps-ua", question: "I just moved to Kraków from Kharkiv with my 5-year-old daughter. Where do I start?" },
    { id: "pesel", question: "Where can I get a PESEL number and what do I need to bring?" },
    { id: "15min-wielicka", question: "I rent a flat at ul. Wielicka 28. What is within 15 minutes?" },
    { id: "kindergartens", question: "Which kindergartens near me are the biggest?" },
  ],
};

export function getStarters(locale: Locale): Starter[] {
  return STARTERS[locale];
}

const normalizeQuestion = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Starter id when `text` is exactly a starter of `locale` (ignoring case and punctuation). */
export function matchStarter(locale: Locale, text: string): string | null {
  const wanted = normalizeQuestion(text);
  return STARTERS[locale].find((s) => normalizeQuestion(s.question) === wanted)?.id ?? null;
}
