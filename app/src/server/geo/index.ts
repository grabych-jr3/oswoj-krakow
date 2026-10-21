// Public entry of zone A: import GeoService only from "@/server/geo" (AGENTS.md rule 2).
import type { GeoService } from "@/contracts/geo";
import { districts } from "./districts";
import { createMockGeoService } from "./mock";

export type { GeoService } from "@/contracts/geo";

/**
 * GEO_IMPL=real is built up task by task: getDistrict is real (A4, all 18 districts);
 * geocode, findPlaces, nearby and getPlace still come from the mock until A9.
 */
function createRealGeoService(): GeoService {
  return { ...createMockGeoService(), getDistrict: async (q) => districts.getDistrict(q) };
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
