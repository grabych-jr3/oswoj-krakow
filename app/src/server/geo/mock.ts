// Mock GeoService (GEO_IMPL=mock, PLAN.md §5.4): answers from the sample fixtures only.
// Real data and routing come in A2–A9; until then B and C develop against this.
import type { LngLat } from "@/contracts/common";
import { GeocodeResult, NearbyResult, type GeoService } from "@/contracts/geo";
import { Place, type DistrictStats } from "@/contracts/place";
import nearbyJson from "@/contracts/fixtures/nearby.sample.json";
import placesJson from "@/contracts/fixtures/places.sample.json";

// Parsing at load fails fast if a fixture drifts from the contracts.
export const samplePlaces: Place[] = Place.array().parse(placesJson);
export const sampleNearby: NearbyResult = NearbyResult.parse(nearbyJson);

const DEFAULT_RADIUS_M = 1500;
const DEFAULT_LIMIT = 10;
const DEFAULT_GEOCODE_LIMIT = 5;
const DISTRICT_LOOKUP_MAX_M = 3000;

/** Great-circle distance in metres. */
export function distanceM(a: LngLat, b: LngLat): number {
  const R = 6371008.8;
  const rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad;
  const dLng = (b[0] - a[0]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Lowercase, strip Polish diacritics and punctuation for loose matching. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function matches(haystack: string, query: string): boolean {
  const h = normalize(haystack);
  return normalize(query)
    .split(" ")
    .every((token) => h.includes(token));
}

// Mock walking estimate: straight-line distance × detour factor at walking speed (same as nearby.sample.json).
const WALK_M_PER_MIN = 80;
const DETOUR = 1.25;
const MINUTES = 15;
const AREA_VERTICES = 16;
export const MOCK_METHOD = "mock fixture: straight-line distance × 1.25 at 80 m/min (not a routed isochrone)";

// «Indeks 15 minut» base groups (PLAN.md §4.3); the first category names the group in `missing`.
const SCORE_GROUPS: Place["category"][][] = [
  ["zlobek", "klub_dzieciecy"], ["przedszkole"], ["szkola_podstawowa"],
  ["park", "park_kieszonkowy"], ["biblioteka"], ["przystanek"],
];

/** Builds a NearbyResult around any point from the given places, using the mock walking estimate. */
export function estimateNearby(places: Place[], origin: LngLat): NearbyResult {
  const reachM = (MINUTES * WALK_M_PER_MIN) / DETOUR;
  const ring: LngLat[] = [];
  for (let i = 0; i <= AREA_VERTICES; i++) {
    const t = ((i % AREA_VERTICES) / AREA_VERTICES) * 2 * Math.PI;
    ring.push([
      +(origin[0] + (reachM * Math.sin(t)) / (111320 * Math.cos((origin[1] * Math.PI) / 180))).toFixed(6),
      +(origin[1] + (reachM * Math.cos(t)) / 110574).toFixed(6),
    ]);
  }
  const reached = places
    .map((p) => ({ ...p, minutes: Math.round((distanceM(origin, p.coords) * DETOUR) / WALK_M_PER_MIN) }))
    .filter((p) => p.minutes <= MINUTES)
    .sort((a, b) => a.minutes - b.minutes);
  const counts: Record<string, number> = {};
  for (const p of reached) counts[p.category] = (counts[p.category] ?? 0) + 1;
  const missing = SCORE_GROUPS.filter((group) => !group.some((c) => counts[c])).map((group) => group[0]);
  return {
    origin: { label: `${origin[1].toFixed(5)}, ${origin[0].toFixed(5)}`, coords: origin },
    mode: "walk",
    minutes: MINUTES,
    area: { type: "Feature", geometry: { type: "Polygon", coordinates: [ring] }, properties: { mode: "walk", minutes: MINUTES } },
    counts,
    places: reached,
    score: { value: Math.round((100 * (SCORE_GROUPS.length - missing.length)) / SCORE_GROUPS.length), missing },
    method: MOCK_METHOD,
  };
}

export function createMockGeoService(places: Place[] = samplePlaces, nearbyFixture: NearbyResult = sampleNearby): GeoService {
  const byId = new Map(places.map((p) => [p.id, p]));

  const addressBook: GeocodeResult[] = [
    { label: nearbyFixture.origin.label, coords: nearbyFixture.origin.coords, district: places[0]?.district ?? null, precision: "address" },
    ...places.map((p) => ({ label: p.address, coords: p.coords, district: p.district, precision: "address" as const })),
  ];

  function districtStats(number: number): DistrictStats | null {
    const inDistrict = places.filter((p) => p.district?.number === number);
    const district = inDistrict[0]?.district;
    if (!district) return null;
    const placeCounts: Record<string, number> = {};
    for (const p of inDistrict) placeCounts[p.category] = (placeCounts[p.category] ?? 0) + 1;
    // Residents and citizenship stats are not in the fixtures; never invented (A4 brings real ones).
    return { ...district, residents: null, foreigners: null, topCitizenships: [], placeCounts };
  }

  return {
    async geocode(query, limit = DEFAULT_GEOCODE_LIMIT) {
      if (!normalize(query)) return [];
      const seen = new Set<string>();
      return addressBook
        .filter((r) => matches(r.label, query))
        .filter((r) => !seen.has(r.label) && seen.add(r.label))
        .slice(0, limit);
    },

    async findPlaces({ categories, near, radiusM = DEFAULT_RADIUS_M, district, text, limit = DEFAULT_LIMIT }) {
      return places
        .filter((p) => categories.length === 0 || categories.includes(p.category))
        .filter((p) => district === undefined || p.district?.number === district)
        .filter((p) => !text || matches(p.name, text))
        .map((p) => ({ ...p, distanceM: near ? Math.round(distanceM(near, p.coords)) : null }))
        .filter((p) => p.distanceM === null || p.distanceM <= radiusM)
        .sort((a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0))
        .slice(0, limit);
    },

    async nearby({ origin, mode, categories }) {
      // The fixture origin gets the fixture; any other point gets the same estimate computed around it.
      const sameOrigin = distanceM(origin, nearbyFixture.origin.coords) < 50;
      const base = sameOrigin ? nearbyFixture : estimateNearby(places, origin);
      const keep = (c: string) => !categories || categories.includes(c as Place["category"]);
      return {
        ...base,
        origin: { label: base.origin.label, coords: origin },
        mode,
        places: base.places.filter((p) => keep(p.category)),
        counts: Object.fromEntries(Object.entries(base.counts).filter(([c]) => keep(c))),
      };
    },

    async getPlace(id) {
      return byId.get(id) ?? null;
    },

    async getDistrict(q) {
      if (typeof q === "number") return districtStats(q);
      let nearest: Place | null = null;
      let best = DISTRICT_LOOKUP_MAX_M;
      for (const p of places) {
        const d = distanceM(q, p.coords);
        if (d <= best && p.district) [nearest, best] = [p, d];
      }
      return nearest?.district ? districtStats(nearest.district.number) : null;
    },
  };
}
