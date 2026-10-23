// Public entry of zone B for the UI (AGENTS.md rule 2): starter questions shown as chat suggestions.
// The UI shows the topics first, opens a topic into its questions, and offers free typing below them.
// Every question here is covered by the eval (evals/cases.json); answers to them are cached by /api/chat.
import type { Locale } from "@/contracts/common";

export interface Starter {
  id: string;
  question: string;
}

export interface StarterTopic {
  id: string;
  title: string;
  questions: Starter[];
}

const TOPICS: Record<Locale, StarterTopic[]> = {
  pl: [
    {
      id: "documents",
      title: "Pierwsze kroki i dokumenty",
      questions: [
        { id: "first-steps-ua", question: "Właśnie przeprowadziłem się do Krakowa z Charkowa z 5-letnią córką. Od czego zacząć?" },
        { id: "pesel", question: "Gdzie mogę uzyskać PESEL i co muszę zabrać?" },
        { id: "zameldowanie", question: "Jak się zameldować na pobyt stały w Krakowie?" },
        { id: "zameldowanie-dorm", question: "Jak zameldować się w akademiku?" },
        { id: "transcription", question: "Jak przenieść zagraniczny akt urodzenia do polskiego rejestru?" },
      ],
    },
    {
      id: "family",
      title: "Dzieci i rodzina",
      questions: [
        { id: "family-moving", question: "Przeprowadzamy się z dwójką dzieci do Krakowa. O czym musimy pamiętać?" },
        { id: "kindergartens", question: "Które przedszkola w pobliżu ul. Wielickiej 28 są największe?" },
        { id: "nurseries-district", question: "Pokaż żłobki w Podgórzu." },
        { id: "birth", question: "Jak zarejestrować urodzenie dziecka?" },
        { id: "big-family", question: "Jak dostać Kartę Dużej Rodziny?" },
      ],
    },
    {
      id: "car",
      title: "Samochód i prawo jazdy",
      questions: [
        { id: "car-import", question: "Kupiłem samochód w Niemczech. Jak go zarejestrować w Krakowie?" },
        { id: "license-exchange", question: "Jak wymienić zagraniczne prawo jazdy na polskie?" },
        { id: "pkk", question: "Chcę zrobić prawo jazdy. Jak uzyskać PKK?" },
        { id: "parking", question: "Jak dostać abonament parkingowy dla mieszkańca?" },
      ],
    },
    {
      id: "neighbourhood",
      title: "Mieszkanie i okolica",
      questions: [
        { id: "15min-wielicka", question: "Wynajmuję mieszkanie przy ul. Wielickiej 28. Co mam w zasięgu 15 minut?" },
        { id: "15min-transit", question: "Co mam w zasięgu 15 minut komunikacją miejską z ul. Wielickiej 28?" },
        { id: "nearest-office", question: "Gdzie jest najbliższy urząd miasta od ul. Wielickiej 28?" },
        { id: "waste", question: "Gdzie złożyć deklarację o opłacie za śmieci po przeprowadzce?" },
      ],
    },
  ],
  uk: [
    {
      id: "documents",
      title: "Перші кроки та документи",
      questions: [
        { id: "first-steps-ua", question: "Я щойно переїхав до Кракова з Харкова з донькою 5 років. З чого почати?" },
        { id: "pesel", question: "Де можна отримати PESEL і що треба взяти з собою?" },
        { id: "zameldowanie", question: "Як зробити прописку (meldunek) у Кракові?" },
        { id: "zameldowanie-dorm", question: "Як оформити meldunek в гуртожитку?" },
        { id: "transcription", question: "Як перенести іноземне свідоцтво про народження до польського реєстру?" },
      ],
    },
    {
      id: "family",
      title: "Діти та сім'я",
      questions: [
        { id: "family-moving", question: "Ми переїжджаємо до Кракова з двома дітьми. Про що треба пам'ятати?" },
        { id: "kindergartens", question: "Які садочки біля вул. Wielicka 28 найбільші?" },
        { id: "nurseries-district", question: "Покажи ясла в районі Podgórze." },
        { id: "birth", question: "У мене народилася дитина в Кракові. Як зареєструвати народження?" },
        { id: "big-family", question: "Як отримати Kartę Dużej Rodziny?" },
      ],
    },
    {
      id: "car",
      title: "Авто та посвідчення водія",
      questions: [
        { id: "car-import", question: "Я купив авто в Німеччині. Як зареєструвати його в Кракові?" },
        { id: "license-exchange", question: "Як обміняти українське посвідчення водія на польське?" },
        { id: "pkk", question: "Хочу отримати права. Як оформити PKK?" },
        { id: "parking", question: "Як отримати абонемент на паркування для мешканця?" },
      ],
    },
    {
      id: "neighbourhood",
      title: "Житло та околиці",
      questions: [
        { id: "15min-wielicka", question: "Я винаймаю квартиру на вул. Wielicka 28. Що є в межах 15 хвилин?" },
        { id: "15min-transit", question: "Що є в межах 15 хвилин громадським транспортом від вул. Wielicka 28?" },
        { id: "nearest-office", question: "Де найближчий міський уряд від вул. Wielicka 28?" },
        { id: "waste", question: "Куди подати декларацію про плату за сміття після переїзду?" },
      ],
    },
  ],
  en: [
    {
      id: "documents",
      title: "First steps and documents",
      questions: [
        { id: "first-steps-ua", question: "I just moved to Kraków from Kharkiv with my 5-year-old daughter. Where do I start?" },
        { id: "pesel", question: "Where can I get a PESEL number and what do I need to bring?" },
        { id: "zameldowanie", question: "How do I register my address in Kraków?" },
        { id: "zameldowanie-dorm", question: "How do I register my address in a student dormitory?" },
        { id: "transcription", question: "How do I transfer a foreign birth certificate to the Polish register?" },
      ],
    },
    {
      id: "family",
      title: "Children and family",
      questions: [
        { id: "family-moving", question: "We are moving to Kraków with two children. What do we need to remember?" },
        { id: "kindergartens", question: "Which kindergartens near ul. Wielicka 28 are the biggest?" },
        { id: "nurseries-district", question: "Show me nurseries in Podgórze." },
        { id: "birth", question: "How do I register the birth of my child in Kraków?" },
        { id: "big-family", question: "How do I get the Large Family Card (Karta Dużej Rodziny)?" },
      ],
    },
    {
      id: "car",
      title: "Car and driving licence",
      questions: [
        { id: "car-import", question: "I bought a car in Germany. How do I register it in Kraków?" },
        { id: "license-exchange", question: "How do I exchange a foreign driving licence for a Polish one?" },
        { id: "pkk", question: "I want to get a driving licence. How do I get a PKK?" },
        { id: "parking", question: "How do I get a resident parking permit?" },
      ],
    },
    {
      id: "neighbourhood",
      title: "Home and neighbourhood",
      questions: [
        { id: "15min-wielicka", question: "I rent a flat at ul. Wielicka 28. What is within 15 minutes?" },
        { id: "15min-transit", question: "What can I reach within 15 minutes by public transport from ul. Wielicka 28?" },
        { id: "nearest-office", question: "Where is the nearest city office to ul. Wielicka 28?" },
        { id: "waste", question: "Where do I file the waste fee declaration after moving?" },
      ],
    },
  ],
};

/** Topics with their questions, in display order. */
export function getStarterTopics(locale: Locale): StarterTopic[] {
  return TOPICS[locale];
}

/** The first question of each topic: a short list for a UI that does not show topics yet. */
export function getStarters(locale: Locale): Starter[] {
  return TOPICS[locale].map((topic) => topic.questions[0]);
}

const allStarters = (locale: Locale) => TOPICS[locale].flatMap((topic) => topic.questions);

const normalizeQuestion = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Starter id when `text` is exactly a starter of `locale` (ignoring case and punctuation). */
export function matchStarter(locale: Locale, text: string): string | null {
  const wanted = normalizeQuestion(text);
  return allStarters(locale).find((s) => normalizeQuestion(s.question) === wanted)?.id ?? null;
}
