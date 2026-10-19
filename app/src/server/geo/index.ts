// Public entry of zone A: import GeoService only from "@/server/geo" (AGENTS.md rule 2).
import type { GeoService } from "@/contracts/geo";
import { createMockGeoService } from "./mock";

export type { GeoService } from "@/contracts/geo";

function createGeoService(): GeoService {
  const impl = process.env.GEO_IMPL ?? "real";
  if (impl !== "mock") {
    // The real implementation lands in A9; until then every caller gets the mock.
    console.warn(`[geo] GEO_IMPL=${impl} is not implemented yet, using mock`);
  }
  return createMockGeoService();
}

export const geo: GeoService = createGeoService();
