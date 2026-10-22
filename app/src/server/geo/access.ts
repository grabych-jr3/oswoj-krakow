// Real «15 minut» (A8): app/data/geo/access.json + places.json, written by `uv run geo-access`.
// Per H3 cell and mode, the precomputed r5py reach: cells (for the zone) and places with minutes.
import { cellsToMultiPolygon, gridDiskDistances, latLngToCell } from "h3-js";
import { z } from "zod";
import type { LngLat } from "@/contracts/common";
import type { NearbyResult, TravelMode } from "@/contracts/geo";
import { Place, type PlaceCategory } from "@/contracts/place";
import accessJson from "../../../data/geo/access.json";
import placesJson from "../../../data/geo/places.json";
import { geocoder } from "./geocode";

const MAX_PER_CATEGORY = 10; // NearbyResult.places: "≤10 на категорію"
const NEAREST_CELL_RINGS = 2; // a point just outside the grid (river bank, city edge) uses a cell ≤2 rings away

// «Indeks 15 minut» base groups (PLAN.md §4.3); the first category names the group in `missing`.
const SCORE_GROUPS: PlaceCategory[][] = [
  ["zlobek", "klub_dzieciecy"], ["przedszkole"], ["szkola_podstawowa"],
  ["park", "park_kieszonkowy"], ["biblioteka"], ["przystanek"],
];

/** One cell's reach in one mode: reachable cells (indexes) and places as [place index, minutes]. */
type Reach = { c: number[]; p: [number, number][] };
export type AccessData = {
  res: number;
  minutes: number;
  method: string;
  cells: string[];
  modes: Record<TravelMode, Reach[]>;
};

/** Shape check only: the full structure is validated offline by scripts/validate-geo.ts. */
const AccessHeader = z.object({
  res: z.number().int(),
  minutes: z.number().int(),
  method: z.string(),
  cells: z.array(z.string()).min(1),
  modes: z.object({ walk: z.array(z.unknown()), transit: z.array(z.unknown()) }),
});

/** `labelOf` names the origin (e.g. the nearest address); without it, or when it returns null, coordinates. */
export function createAccess(data: AccessData, places: Place[], labelOf?: (point: LngLat) => string | null) {
  const cellIndex = new Map(data.cells.map((c, i) => [c, i]));

  function cellOf([lng, lat]: LngLat): string {
    return latLngToCell(lat, lng, data.res);
  }

  /**
   * The grid cell whose reach answers for a point: its own cell, or the nearest cell ≤2 rings away
   * that has data — for points just outside the grid and for the few cells whose centre the router
   * could not snap to a street (river, rail yard).
   */
  function answeringCell(cell: string, mode: TravelMode): number | undefined {
    let fallback: number | undefined;
    for (const ring of gridDiskDistances(cell, NEAREST_CELL_RINGS)) {
      for (const candidate of [...ring].sort()) {
        const i = cellIndex.get(candidate);
        if (i === undefined) continue;
        fallback ??= i;
        const r = data.modes[mode][i];
        if (r.c.length || r.p.length) return i;
      }
    }
    return fallback;
  }

  return {
    nearby(q: { origin: LngLat; mode: TravelMode; categories?: PlaceCategory[] }): NearbyResult {
      const [lng, lat] = q.origin;
      const ownCell = cellOf(q.origin);
      const index = answeringCell(ownCell, q.mode);
      const reach: Reach = index === undefined ? { c: [], p: [] } : data.modes[q.mode][index];
      // the point's own cell always belongs to its zone, so the origin is never drawn outside it
      const zoneCells = [...new Set([ownCell, ...reach.c.map((i) => data.cells[i])])];

      const reached = reach.p.map(([i, minutes]) => ({ ...places[i], minutes }));
      const present = new Set(reached.map((p) => p.category));
      const missing = SCORE_GROUPS.filter((g) => !g.some((c) => present.has(c))).map((g) => g[0]);

      const keep = (c: PlaceCategory) => !q.categories || q.categories.includes(c);
      const counts: Record<string, number> = {};
      const listed: Record<string, number> = {};
      const nearest = [];
      for (const p of reached) {
        if (!keep(p.category)) continue;
        counts[p.category] = (counts[p.category] ?? 0) + 1;
        listed[p.category] = (listed[p.category] ?? 0) + 1;
        if (listed[p.category] <= MAX_PER_CATEGORY) nearest.push(p);
      }

      return {
        origin: { label: labelOf?.(q.origin) ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`, coords: q.origin },
        mode: q.mode,
        minutes: data.minutes,
        area: {
          type: "Feature",
          geometry: { type: "MultiPolygon", coordinates: cellsToMultiPolygon(zoneCells, true) },
          properties: { mode: q.mode, minutes: data.minutes, cells: zoneCells.length },
        },
        counts,
        places: nearest,
        score: {
          value: index === undefined ? 0 : Math.round((100 * (SCORE_GROUPS.length - missing.length)) / SCORE_GROUPS.length),
          missing,
        },
        method: index === undefined ? `${data.method}; point outside Kraków` : data.method,
      };
    },
  };
}

// Places are small enough to validate at load; the access matrix is only shape-checked here.
const placesData: Place[] = Place.array().parse(placesJson);
AccessHeader.parse(accessJson);
export const access = createAccess(accessJson as unknown as AccessData, placesData, (p) => geocoder.reverse(p));
export { placesData };
