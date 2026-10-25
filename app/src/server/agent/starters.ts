// Public entry of zone B for the UI (AGENTS.md rule 2): starter questions shown as chat suggestions.
// The UI shows the topics first, opens a topic into its questions, and offers free typing below them.
// Questions are general, so anyone can pick one; evals/starters.json checks every one of them.
// Answers to them are cached by /api/chat.
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
        { id: "first-steps", question: "Od czego zacząć po przeprowadzce do Krakowa?" },
        { id: "pesel", question: "Jak uzyskać numer PESEL?" },
        { id: "zameldowanie", question: "Jak się zameldować w Krakowie?" },
        { id: "id-card", question: "Jak wyrobić dowód osobisty?" },
        { id: "transcription", question: "Jak przenieść zagraniczny akt urodzenia lub małżeństwa do polskiego rejestru?" },
      ],
    },
    {
      id: "family",
      title: "Dzieci i rodzina",
      questions: [
        { id: "family-moving", question: "O czym pamiętać, przeprowadzając się do Krakowa z dziećmi?" },
        { id: "family-allowance", question: "Jak dostać zasiłek rodzinny?" },
        { id: "kids-places", question: "Gdzie znajdę przedszkola i żłobki w okolicy?" },
        { id: "birth", question: "Jak zarejestrować urodzenie dziecka?" },
        { id: "big-family", question: "Jak dostać Kartę Dużej Rodziny?" },
      ],
    },
    {
      id: "car",
      title: "Samochód i prawo jazdy",
      questions: [
        { id: "car-register", question: "Jak zarejestrować samochód w Krakowie?" },
        { id: "car-address", question: "Jak zmienić adres w dowodzie rejestracyjnym?" },
        { id: "license-exchange", question: "Jak wymienić zagraniczne prawo jazdy na polskie?" },
        { id: "pkk", question: "Jak uzyskać profil kandydata na kierowcę (PKK)?" },
        { id: "parking", question: "Jak dostać abonament parkingowy dla mieszkańca?" },
      ],
    },
    {
      id: "neighbourhood",
      title: "Mieszkanie i okolica",
      questions: [
        { id: "15min", question: "Co mam w zasięgu 15 minut od domu?" },
        { id: "nearest-office", question: "Gdzie jest najbliższy urząd miasta?" },
        { id: "waste", question: "Jak złożyć deklarację o opłacie za śmieci?" },
        { id: "housing-allowance", question: "Jak dostać dodatek mieszkaniowy?" },
      ],
    },
  ],
  uk: [
    {
      id: "documents",
      title: "Перші кроки та документи",
      questions: [
        { id: "first-steps", question: "З чого почати після переїзду до Кракова?" },
        { id: "pesel", question: "Як отримати номер PESEL?" },
        { id: "zameldowanie", question: "Як зробити прописку (meldunek) у Кракові?" },
        { id: "id-card", question: "Як оформити польське посвідчення особи (dowód osobisty)?" },
        { id: "transcription", question: "Як перенести іноземне свідоцтво про народження чи шлюб до польського реєстру?" },
      ],
    },
    {
      id: "family",
      title: "Діти та сім'я",
      questions: [
        { id: "family-moving", question: "Про що пам'ятати, переїжджаючи до Кракова з дітьми?" },
        { id: "family-allowance", question: "Як отримати сімейну допомогу (zasiłek rodzinny)?" },
        { id: "kids-places", question: "Де знайти садочки та ясла поблизу?" },
        { id: "birth", question: "Як зареєструвати народження дитини?" },
        { id: "big-family", question: "Як отримати Kartę Dużej Rodziny?" },
      ],
    },
    {
      id: "car",
      title: "Авто та посвідчення водія",
      questions: [
        { id: "car-register", question: "Як зареєструвати авто в Кракові?" },
        { id: "car-address", question: "Як змінити адресу в техпаспорті авто?" },
        { id: "license-exchange", question: "Як обміняти іноземне посвідчення водія на польське?" },
        { id: "pkk", question: "Як отримати профіль кандидата у водії (PKK)?" },
        { id: "parking", question: "Як отримати абонемент на паркування для мешканця?" },
      ],
    },
    {
      id: "neighbourhood",
      title: "Житло та околиці",
      questions: [
        { id: "15min", question: "Що є в межах 15 хвилин від дому?" },
        { id: "nearest-office", question: "Де найближчий міський уряд?" },
        { id: "waste", question: "Як подати декларацію про плату за сміття?" },
        { id: "housing-allowance", question: "Як отримати житлову допомогу (dodatek mieszkaniowy)?" },
      ],
    },
  ],
  en: [
    {
      id: "documents",
      title: "First steps and documents",
      questions: [
        { id: "first-steps", question: "Where do I start after moving to Kraków?" },
        { id: "pesel", question: "How do I get a PESEL number?" },
        { id: "zameldowanie", question: "How do I register my address in Kraków?" },
        { id: "id-card", question: "How do I get a Polish ID card?" },
        { id: "transcription", question: "How do I transfer a foreign birth or marriage certificate to the Polish register?" },
      ],
    },
    {
      id: "family",
      title: "Children and family",
      questions: [
        { id: "family-moving", question: "What should I take care of when moving to Kraków with children?" },
        { id: "family-allowance", question: "How do I get family allowance (zasiłek rodzinny)?" },
        { id: "kids-places", question: "Where can I find kindergartens and nurseries nearby?" },
        { id: "birth", question: "How do I register the birth of my child?" },
        { id: "big-family", question: "How do I get the Large Family Card (Karta Dużej Rodziny)?" },
      ],
    },
    {
      id: "car",
      title: "Car and driving licence",
      questions: [
        { id: "car-register", question: "How do I register a car in Kraków?" },
        { id: "car-address", question: "How do I change the address in my vehicle registration?" },
        { id: "license-exchange", question: "How do I exchange a foreign driving licence for a Polish one?" },
        { id: "pkk", question: "How do I get a driver candidate profile (PKK)?" },
        { id: "parking", question: "How do I get a resident parking permit?" },
      ],
    },
    {
      id: "neighbourhood",
      title: "Home and neighbourhood",
      questions: [
        { id: "15min", question: "What is within 15 minutes of my home?" },
        { id: "nearest-office", question: "Where is the nearest city office?" },
        { id: "waste", question: "How do I file the waste fee declaration?" },
        { id: "housing-allowance", question: "How do I get housing allowance (dodatek mieszkaniowy)?" },
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
