// app/src/contracts/kb.ts
import { z } from "zod";
import { LngLat, Locale } from "./common";
import { PlaceCategory } from "./place";

export const Office = z.object({
  /** "urzad:<slug>" — генерує B; A геокодує з ТИМ САМИМ id.
   *  slug = вулиця + номер (до першої коми): lowercase; ł→l, решта діакритики знімається;
   *  ініціали імен («W.») прибираються; усе, що не літера/цифра → "_" (без повторів і на краях).
   *  "ul. Wielicka 28A, 30-553 Kraków" → "urzad:ul_wielicka_28a"; "ul. W. Reymonta 20" → "urzad:ul_reymonta_20";
   *  "os. Złotego Wieku 2" → "urzad:os_zlotego_wieku_2" */
  id: z.string().regex(/^urzad:[a-z0-9]+(_[a-z0-9]+)*$/),
  name: z.string(),
  address: z.string(),
  hours: z.string().nullable(),
  bookingUrl: z.string().url().nullable(),
  phone: z.string().nullable(),
  coords: LngLat.nullable(),           // у procedures.json = null; у рантаймі заповнює агент через GeoService.getPlace(id)
});
export type Office = z.infer<typeof Office>;

export const LifeTag = z.enum([
  "przeprowadzka", "cudzoziemiec", "obywatel_ua", "dziecko", "edukacja", "praca",
  "pojazd", "mieszkanie", "pomoc_spoleczna", "dokumenty", "inne",
]);

export const Procedure = z.object({
  symbol: z.string(),                  // "SA-34"
  title: z.string(),
  bipUrl: z.string().url(),
  department: z.string().nullable(),
  version: z.number().nullable(),
  publishedAt: z.string().nullable(),
  tags: z.array(LifeTag),
  relevance: z.number().min(0).max(1), // наскільки стосується нових мешканців
  sections: z.object({                 // Markdown польською (з HTML картки)
    opis: z.string().nullable(),
    kogoDotyczy: z.string().nullable(),
    kryteria: z.string().nullable(),
    dokumenty: z.string().nullable(),
    oplaty: z.string().nullable(),
    sposob: z.string().nullable(),
    informacje: z.string().nullable(),
    termin: z.string().nullable(),
    komorka: z.string().nullable(),
    podstawaPrawna: z.string().nullable(),
  }),
  offices: z.array(Office),
  attachments: z.array(z.object({ title: z.string(), url: z.string().url() })),
});
export type Procedure = z.infer<typeof Procedure>;

export const Scenario = z.object({
  id: z.string(),                      // "obywatel-ua", "cudzoziemiec-spoza-ue", …
  locale: Locale,
  title: z.string(),
  forWhom: z.string(),
  steps: z.array(z.object({
    order: z.number().int(),
    title: z.string(),
    why: z.string(),
    when: z.string().nullable(),       // термін — ТІЛЬКИ якщо він є в джерелі
    procedureSymbols: z.array(z.string()),
    placeCategories: z.array(PlaceCategory),
    external: z.array(z.object({ title: z.string(), url: z.string().url() })), // офіційні сайти поза містом
  })).min(3),
  sources: z.array(z.string().url()),
});
export type Scenario = z.infer<typeof Scenario>;
// Файли (B): app/data/kb/procedures.json (Procedure[]), app/data/kb/scenarios.{pl,uk,en}.json (Scenario[]),
//            app/data/kb/offices_raw.json (Office[] з coords=null) → вхід для A (шар "urzad", ті самі id)
