// Real district lookup (A4): app/data/geo/districts.json, written by `uv run geo-districts`.
import type { LngLat } from "@/contracts/common";
import type { DistrictStats } from "@/contracts/place";
import { DistrictCollection } from "./district-area";
import { inPolygon } from "./geometry";
import districtsJson from "../../../data/geo/districts.json";

export function createDistrictLookup(collection: DistrictCollection) {
  const byNumber = new Map(collection.features.map((f) => [f.properties.number, f]));
  return {
    /** Stats of a district by number (1–18), or of the district containing a point; null outside Kraków. */
    getDistrict(q: number | LngLat): DistrictStats | null {
      if (typeof q === "number") return byNumber.get(q)?.properties ?? null;
      for (const f of collection.features) {
        const polygons = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
        if (polygons.some((rings) => inPolygon(q, rings))) return f.properties;
      }
      return null;
    },
  };
}

// Parsed once at load; a drift from the contract fails fast.
export const districts = createDistrictLookup(DistrictCollection.parse(districtsJson));
