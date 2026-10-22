// Public entry of zone A: import GeoService only from "@/server/geo" (AGENTS.md rule 2).
import type { GeoService } from "@/contracts/geo";
import { access } from "./access";
import { districts } from "./districts";
import { geocoder } from "./geocode";
import { createMockGeoService } from "./mock";
import { places } from "./places";

export type { GeoService } from "@/contracts/geo";

/**
 * GEO_IMPL=real (default): EMUiA geocoder (A9), all places of the layers (A3–A7, A9), districts (A4)
 * and the r5py 15-minute index (A8). GEO_IMPL=mock: the sample fixtures of A0.
 */
function createRealGeoService(): GeoService {
  return {
    geocode: async (query, limit) => geocoder.geocode(query, limit),
    findPlaces: async (q) => places.findPlaces(q),
    nearby: async (q) => access.nearby(q),
    getPlace: async (id) => places.getPlace(id),
    getDistrict: async (q) => districts.getDistrict(q),
  };
}

function createGeoService(): GeoService {
  const impl = process.env.GEO_IMPL ?? "real";
  if (impl === "mock") return createMockGeoService();
  if (impl !== "real") console.warn(`[geo] unknown GEO_IMPL=${impl}, using real`);
  return createRealGeoService();
}

/**
 * Conventions beyond the contract (apply to mock and real implementations):
 * - findPlaces({ categories: [] }) means all categories.
 * - findPlaces without `near` returns `distanceM: null` and ignores `radiusM`.
 */
export const geo: GeoService = createGeoService();
