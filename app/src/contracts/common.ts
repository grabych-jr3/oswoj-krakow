// app/src/contracts/common.ts
import { z } from "zod";

/** [lng, lat] у WGS84 (EPSG:4326) */
export const LngLat = z.tuple([z.number(), z.number()]);
export type LngLat = z.infer<typeof LngLat>;

export const Locale = z.enum(["pl", "uk", "en"]);
export type Locale = z.infer<typeof Locale>;

export const SourceRef = z.object({
  dataset: z.string(),               // slug датасету порталу або "bip" | "msip-emuia" | "osm" | "ztp-gtfs" | "ztp-arcgis"
  url: z.string().url(),
  updatedAt: z.string().nullable(),  // ISO-дата стану даних
});
export type SourceRef = z.infer<typeof SourceRef>;
