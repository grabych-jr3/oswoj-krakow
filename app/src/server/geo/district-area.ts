import { z } from "zod";
import { LngLat } from "@/contracts/common";
import { District, DistrictStats } from "@/contracts/place";

/** One district boundary (GeoJSON Feature, WGS84). Zone A internal; not part of the shared contracts. */
export const DistrictArea = z.object({
  type: z.literal("Feature"),
  properties: District.extend({ source: z.string() }),
  geometry: z.object({ type: z.literal("Polygon"), coordinates: z.array(z.array(LngLat).min(4)).min(1) }),
});
export type DistrictArea = z.infer<typeof DistrictArea>;

const Rings = z.array(z.array(LngLat).min(4)).min(1);

/** The 18 districts (A4): boundary with DistrictStats as properties, PLAN.md §5.3 districts.geojson. */
export const DistrictCollection = z.object({
  type: z.literal("FeatureCollection"),
  features: z
    .array(
      z.object({
        type: z.literal("Feature"),
        geometry: z.discriminatedUnion("type", [
          z.object({ type: z.literal("Polygon"), coordinates: Rings }),
          z.object({ type: z.literal("MultiPolygon"), coordinates: z.array(Rings).min(1) }),
        ]),
        properties: DistrictStats,
      }),
    )
    .length(18),
});
export type DistrictCollection = z.infer<typeof DistrictCollection>;
