// Mock GeoService (GEO_IMPL=mock, PLAN.md §5.4): answers from the sample fixtures only.
// Real data and routing come in A2–A9; until then B and C develop against this.
import type { LngLat } from "@/contracts/common";
import { GeocodeResult, NearbyResult, type GeoService } from "@/contracts/geo";
import { Place, type District, type DistrictStats } from "@/contracts/place";
import nearbyJson from "@/contracts/fixtures/nearby.sample.json";
import placesJson from "@/contracts/fixtures/places.sample.json";
import { DistrictArea } from "./district-area";
import districtJson from "./fixtures/district-13.sample.json";
import { distanceM, inPolygon } from "./geometry";

// Parsing at load fails fast if a fixture drifts from the contracts.
export const samplePlaces: Place[] = Place.array().parse(placesJson);
export const sampleNearby: NearbyResult = NearbyResult.parse(nearbyJson);
/** Real MSIP boundary of district XIII Podgórze — the only district the fixtures cover. */
export const sampleDistrict: DistrictArea = DistrictArea.parse(districtJson);

const DEFAULT_RADIUS_M = 1500;
const DEFAULT_LIMIT = 10;
const DEFAULT_GEOCODE_LIMIT = 5;

export { distanceM, inPolygon };

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

// Only street addresses with a house number are geocodable; parks, stops and P+R have no address point.
const HOUSE_ADDRESS = /^(ul|al|os|pl)\. [^,]+ \d+[a-z]?(\/\d+)?, \d{2}-\d{3} Kraków$/i;

// Mock walking estimate: straight-line distance × detour factor at walking speed (same as nearby.sample.json).
const WALK_M_PER_MIN = 80;
const DETOUR = 1.25;
const MINUTES = 15;
const AREA_VERTICES = 16;
const MAX_PLACES_PER_CATEGORY = 10; // NearbyResult.places: "≤10 на категорію"
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
    // Counterclockwise from east, as RFC 7946 requires for exterior rings.
    const t = ((i % AREA_VERTICES) / AREA_VERTICES) * 2 * Math.PI;
    ring.push([
      +(origin[0] + (reachM * Math.cos(t)) / (111320 * Math.cos((origin[1] * Math.PI) / 180))).toFixed(6),
      +(origin[1] + (reachM * Math.sin(t)) / 110574).toFixed(6),
    ]);
  }
  const inZone = places
    .map((p) => ({ ...p, minutes: Math.round((distanceM(origin, p.coords) * DETOUR) / WALK_M_PER_MIN) }))
    .filter((p) => p.minutes <= MINUTES)
    .sort((a, b) => a.minutes - b.minutes);
  const counts: Record<string, number> = {};
  for (const p of inZone) counts[p.category] = (counts[p.category] ?? 0) + 1;
  const listed: Record<string, number> = {};
  const nearest = inZone.filter((p) => (listed[p.category] = (listed[p.category] ?? 0) + 1) <= MAX_PLACES_PER_CATEGORY);
  const missing = SCORE_GROUPS.filter((group) => !group.some((c) => counts[c])).map((group) => group[0]);
  return {
    origin: { label: `${origin[1].toFixed(5)}, ${origin[0].toFixed(5)}`, coords: origin },
    mode: "walk",
    minutes: MINUTES,
    area: { type: "Feature", geometry: { type: "Polygon", coordinates: [ring] }, properties: { mode: "walk", minutes: MINUTES } },
    counts,
    places: nearest,
    score: { value: Math.round((100 * (SCORE_GROUPS.length - missing.length)) / SCORE_GROUPS.length), missing },
    method: MOCK_METHOD,
  };
}

export function createMockGeoService(
  places: Place[] = samplePlaces,
  nearbyFixture: NearbyResult = sampleNearby,
  districtArea: DistrictArea = sampleDistrict,
): GeoService {
  const byId = new Map(places.map((p) => [p.id, p]));
  const knownDistrict: District = { number: districtArea.properties.number, name: districtArea.properties.name };

  /** The district containing the point, or null outside the one district the mock knows. */
  function districtAt(point: LngLat): District | null {
    return inPolygon(point, districtArea.geometry.coordinates) ? knownDistrict : null;
  }

  const addressBook: GeocodeResult[] = [
    { label: nearbyFixture.origin.label, coords: nearbyFixture.origin.coords },
    ...places.map((p) => ({ label: p.address, coords: p.coords })),
  ]
    .filter(({ label }) => HOUSE_ADDRESS.test(label))
    .map(({ label, coords }) => ({ label, coords, district: districtAt(coords), precision: "address" as const }));

  function districtStats(number: number): DistrictStats | null {
    if (number !== knownDistrict.number) return null;
    const placeCounts: Record<string, number> = {};
    for (const p of places) {
      if (p.district?.number === number) placeCounts[p.category] = (placeCounts[p.category] ?? 0) + 1;
    }
    // Residents and citizenship stats are not in the fixtures; never invented (A4 brings real ones).
    return { ...knownDistrict, residents: null, foreigners: null, topCitizenships: [], placeCounts };
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
        area: { ...base.area, properties: { ...base.area.properties, mode } },
        // The mock has no transit routing: a transit request gets the walking zone, and says so.
        method: mode === "transit" ? `${base.method}; transit not modelled, walking zone shown` : base.method,
        places: base.places.filter((p) => keep(p.category)),
        counts: Object.fromEntries(Object.entries(base.counts).filter(([c]) => keep(c))),
      };
    },

    async getPlace(id) {
      return byId.get(id) ?? null;
    },

    async getDistrict(q) {
      if (typeof q === "number") return districtStats(q);
      const district = districtAt(q);
      return district ? districtStats(district.number) : null;
    },
  };
}
