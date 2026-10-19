// app/src/contracts/place.ts
import { z } from "zod";
import { LngLat, SourceRef } from "./common";

export const PlaceCategory = z.enum([
  "zlobek", "klub_dzieciecy", "przedszkole", "szkola_podstawowa", "szkola_ponadpodstawowa",
  "klub_rodzica", "biblioteka", "park", "park_kieszonkowy", "przystanek", "park_and_ride", "urzad",
  // Should/Could:
  "centrum_seniora", "obiekt_sportowy", "muzeum", "teatr",
]);
export type PlaceCategory = z.infer<typeof PlaceCategory>;

export const District = z.object({ number: z.number().int().min(1).max(18), name: z.string() });
export type District = z.infer<typeof District>;

export const Place = z.object({
  id: z.string(),            // стабільний "<category>:<sourceKey>", напр. "przedszkole:rspo-3786"
  category: PlaceCategory,
  name: z.string(),
  address: z.string(),       // "ul. Młyńska Boczna 4, 31-470 Kraków"
  coords: LngLat,
  district: District.nullable(),
  phone: z.string().nullable(),
  url: z.string().url().nullable(),
  /** Атрибути за категорією:
   *  przedszkole/szkoła: { rspo, children|students, groups, public }
   *  żłobek/klub: { places, operator }   park: { area_ha, type }
   *  przystanek: { code, type: "A"|"T"|"AT" }   urzad: { hours, bookingUrl, procedures: "SA-34,SA-65" } */
  attrs: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
  source: SourceRef,
});
export type Place = z.infer<typeof Place>;

export const DistrictStats = District.extend({
  residents: z.number().int().nullable(),   // zameldowani stały + czasowy (31.12.2025)
  foreigners: z.number().int().nullable(),  // cudzoziemcy stały + czasowy
  topCitizenships: z.array(z.object({ name: z.string(), count: z.number().int() })).max(5),
  placeCounts: z.record(z.string(), z.number().int()), // PlaceCategory → кількість
});
export type DistrictStats = z.infer<typeof DistrictStats>;
