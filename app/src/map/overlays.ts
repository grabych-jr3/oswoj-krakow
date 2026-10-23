import { z } from "zod";
import { DistrictStats } from "@/contracts/place";

/** One hexagon of the city-wide "Indeks 15 minut" layer: index on foot and on foot + KMK (0–100). */
const AccessIndexFile = z.object({
  res: z.number().int(),
  minutes: z.number().int(),
  method: z.string(),
  cells: z.array(z.tuple([z.string(), z.number(), z.number()])),
});

export type AccessIndex = { method: string; cells: GeoJSON.FeatureCollection<GeoJSON.Polygon, { walk: number; transit: number }> };

/**
 * The city-wide index (A10, `access-index.json`) as hexagon polygons. h3-js turns cell ids into
 * outlines in the browser; it loads only when the layer is switched on.
 */
export async function fetchAccessIndex(): Promise<AccessIndex> {
  const [res, h3] = await Promise.all([fetch("/data/layers/access-index.json"), import("h3-js")]);
  if (!res.ok) throw new Error(`access-index.json: HTTP ${res.status}`);
  const file = AccessIndexFile.parse(await res.json());
  return {
    method: file.method,
    cells: {
      type: "FeatureCollection",
      features: file.cells.map(([cell, walk, transit]) => ({
        type: "Feature",
        // `true` = GeoJSON order ([lng, lat]); the ring is closed for MapLibre.
        geometry: { type: "Polygon", coordinates: [closeRing(h3.cellToBoundary(cell, true))] },
        properties: { walk, transit },
      })),
    },
  };
}

function closeRing(ring: number[][]): number[][] {
  const [first] = ring;
  const last = ring[ring.length - 1];
  return first && last && (first[0] !== last[0] || first[1] !== last[1]) ? [...ring, first] : ring;
}

const DistrictFeature = z.object({
  type: z.literal("Feature"),
  geometry: z.object({ type: z.enum(["Polygon", "MultiPolygon"]), coordinates: z.array(z.any()) }),
  properties: DistrictStats,
});

export type DistrictLayer = GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon, DistrictStats>;

/** The 18 districts with their statistics (A4, `districts.geojson`), checked against the contract. */
export async function fetchDistricts(): Promise<DistrictLayer> {
  const res = await fetch("/data/layers/districts.geojson");
  if (!res.ok) throw new Error(`districts.geojson: HTTP ${res.status}`);
  const data = z.object({ features: z.array(DistrictFeature) }).parse(await res.json());
  return { type: "FeatureCollection", features: data.features as DistrictLayer["features"] };
}
