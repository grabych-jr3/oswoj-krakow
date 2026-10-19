// app/src/contracts/geo.ts
import { z } from "zod";
import { LngLat } from "./common";
import { District, DistrictStats, Place, PlaceCategory } from "./place";

export const TravelMode = z.enum(["walk", "transit"]); // transit = пішки + KMK
export type TravelMode = z.infer<typeof TravelMode>;

export const GeocodeResult = z.object({
  label: z.string(),                                  // "ul. Wielicka 28, 30-552 Kraków"
  coords: LngLat,
  district: District.nullable(),
  precision: z.enum(["address", "street", "approx"]),
});
export type GeocodeResult = z.infer<typeof GeocodeResult>;

export const NearbyResult = z.object({
  origin: z.object({ label: z.string(), coords: LngLat }),
  mode: TravelMode,
  minutes: z.number().int(),                          // MVP: 15
  area: z.object({                                    // GeoJSON Feature<Polygon | MultiPolygon>
    type: z.literal("Feature"),
    geometry: z.object({ type: z.enum(["Polygon", "MultiPolygon"]), coordinates: z.array(z.any()) }),
    properties: z.record(z.string(), z.any()),
  }),
  counts: z.record(z.string(), z.number().int()),     // PlaceCategory → кількість у зоні
  places: z.array(Place.extend({ minutes: z.number().nullable() })), // за хвилинами, ≤10 на категорію
  score: z.object({
    value: z.number().min(0).max(100),                // «Indeks 15 minut»
    missing: z.array(PlaceCategory),                  // яких базових груп немає в зоні
  }),
  method: z.string(),                                 // "r5py walk+transit, wt 08:00, GTFS 2026-10-16"
});
export type NearbyResult = z.infer<typeof NearbyResult>;

/** Реалізує A в app/src/server/geo/index.ts. Споживає B (інструменти агента). */
export interface GeoService {
  geocode(query: string, limit?: number): Promise<GeocodeResult[]>;
  findPlaces(q: {
    categories: PlaceCategory[];
    near?: LngLat;
    radiusM?: number;      // типово 1500
    district?: number;
    text?: string;         // пошук за назвою
    limit?: number;        // типово 10
  }): Promise<Array<Place & { distanceM: number | null }>>;
  nearby(q: { origin: LngLat; mode: TravelMode; minutes?: 15; categories?: PlaceCategory[] }): Promise<NearbyResult>;
  getPlace(id: string): Promise<Place | null>;
  getDistrict(q: number | LngLat): Promise<DistrictStats | null>;
}
// HTTP (A): GET /api/geocode?q=…&limit=5 → GeocodeResult[]
//           GET /api/nearby?lng=…&lat=…&mode=walk|transit → NearbyResult
