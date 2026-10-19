import { z } from "zod";
import { LngLat } from "@/contracts/common";
import { District } from "@/contracts/place";

/** One district boundary (GeoJSON Feature, WGS84). Zone A internal; not part of the shared contracts. */
export const DistrictArea = z.object({
  type: z.literal("Feature"),
  properties: District.extend({ source: z.string() }),
  geometry: z.object({ type: z.literal("Polygon"), coordinates: z.array(z.array(LngLat).min(4)).min(1) }),
});
export type DistrictArea = z.infer<typeof DistrictArea>;
