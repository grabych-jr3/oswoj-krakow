// Real place search (A9) over every place of the map layers (app/data/geo/places.json, `uv run geo-access`).
import type { LngLat } from "@/contracts/common";
import type { Place, PlaceCategory } from "@/contracts/place";
import { placesData } from "./access";
import { fold } from "./geocode";
import { distanceM } from "./geometry";

const DEFAULT_RADIUS_M = 1500;
const DEFAULT_LIMIT = 10;

type FindQuery = {
  categories: PlaceCategory[];
  near?: LngLat;
  radiusM?: number;
  district?: number;
  text?: string;
  limit?: number;
};

export function createPlaces(places: Place[]) {
  const byId = new Map(places.map((p) => [p.id, p]));
  const names = new Map(places.map((p) => [p.id, fold(`${p.name} ${p.address}`)]));

  return {
    getPlace(id: string): Place | null {
      return byId.get(id) ?? null;
    },

    /**
     * `categories: []` means all; without `near` the radius is ignored and `distanceM` is null;
     * `text` words must all occur in the name or address (Polish letters optional).
     */
    findPlaces({ categories, near, radiusM = DEFAULT_RADIUS_M, district, text, limit = DEFAULT_LIMIT }: FindQuery) {
      const words = text ? fold(text).split(" ").filter(Boolean) : [];
      const out: Array<Place & { distanceM: number | null }> = [];
      for (const p of places) {
        if (categories.length && !categories.includes(p.category)) continue;
        if (district !== undefined && p.district?.number !== district) continue;
        if (words.length && !words.every((w) => names.get(p.id)!.includes(w))) continue;
        const d = near ? Math.round(distanceM(near, p.coords)) : null;
        if (d !== null && d > radiusM) continue;
        out.push({ ...p, distanceM: d });
      }
      out.sort((a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0) || a.name.localeCompare(b.name, "pl"));
      return out.slice(0, limit);
    },
  };
}

export const places = createPlaces(placesData);
