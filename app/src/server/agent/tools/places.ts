// Handlers of the map tools: find_places, nearby_15min, geocode. All geo work is delegated to zone A.
import type { z } from "zod";
import type { ToolOutputs } from "@/contracts/chat";
import type { LngLat } from "@/contracts/common";
import type { GeocodeResult, TravelMode } from "@/contracts/geo";
import type { PlaceCategory } from "@/contracts/place";
import type { GeoService } from "@/server/geo";
import { normalizePl } from "../kb/normalize";
import { ToolError } from "./errors";

type Output<Name extends keyof typeof ToolOutputs> = z.infer<(typeof ToolOutputs)[Name]>;

const GEOCODE_LIMIT = 5;
const DISTRICT_COUNT = 18;

/** Arabic value of a Roman numeral I–XVIII ("XIII" → 13), the official way Kraków numbers its districts. */
function fromRoman(text: string): number | null {
  if (!/^[ivx]+$/i.test(text)) return null;
  const value: Record<string, number> = { i: 1, v: 5, x: 10 };
  const digits = [...text.toLowerCase()].map((c) => value[c]);
  const n = digits.reduce((sum, d, i) => sum + (d < (digits[i + 1] ?? 0) ? -d : d), 0);
  return n >= 1 && n <= DISTRICT_COUNT ? n : null;
}

/** District number for a name ("Podgórze"), a number ("13") or a Roman numeral ("Dzielnica XIII"). */
async function resolveDistrict(geo: Pick<GeoService, "getDistrict">, district: number | string): Promise<number> {
  if (typeof district === "number") return district;
  const wanted = normalizePl(district).replace(/^dzielnica\s+/, "").trim();
  if (/^\d+$/.test(wanted)) return Number(wanted);
  const roman = fromRoman(wanted);
  if (roman) return roman;

  const all = await Promise.all(Array.from({ length: DISTRICT_COUNT }, (_, i) => geo.getDistrict(i + 1).catch(() => null)));
  const districts = all.filter((d) => d !== null);
  // Exact name first: "Podgórze" (13) is also a substring of "Podgórze Duchackie" (11).
  const exact = districts.find((d) => normalizePl(d.name) === wanted);
  if (exact) return exact.number;
  const partial = districts.filter((d) => normalizePl(d.name).includes(wanted));
  if (partial.length === 1) return partial[0].number;
  if (partial.length > 1) {
    // "Prądnik" is both 3 Prądnik Czerwony and 4 Prądnik Biały: let the model ask instead of guessing.
    const options = partial.map((d) => `${d.number} ${d.name}`).join(", ");
    throw new ToolError(`District "${district}" is ambiguous: ${options}. Ask the user which one.`);
  }
  throw new ToolError(`District "${district}" not found. Search near an address in it instead.`);
}

/** First geocoder match for an address; throws so the model asks the user to rephrase. */
async function resolveAddress(geo: Pick<GeoService, "geocode">, address: string): Promise<GeocodeResult> {
  const [best] = await geo.geocode(address, 1);
  if (!best) throw new ToolError(`Address "${address}" was not found in Kraków. Ask the user for a more precise address.`);
  return best;
}

export async function runGeocode(input: { query: string }, geo: Pick<GeoService, "geocode">): Promise<Output<"geocode">> {
  return { results: await geo.geocode(input.query, GEOCODE_LIMIT) };
}

/** Places for the map; `label` is the marker number the answer text refers to ("1", "2", …). */
export async function runFindPlaces(
  input: {
    categories: PlaceCategory[];
    near?: LngLat;
    address?: string;
    district?: number | string;
    text?: string;
    limit?: number;
  },
  geo: Pick<GeoService, "geocode" | "findPlaces" | "getDistrict">,
): Promise<Output<"find_places">> {
  const center = input.near ?? (input.address ? (await resolveAddress(geo, input.address)).coords : null);
  const places = await geo.findPlaces({
    categories: input.categories,
    near: center ?? undefined,
    district: input.district === undefined ? undefined : await resolveDistrict(geo, input.district),
    text: input.text,
    limit: input.limit,
  });
  return { center, places: places.map((place, i) => ({ ...place, label: String(i + 1) })) };
}

/** 15-minute zone around an address, explicit coords, or the origin already chosen on the map. */
export async function runNearby(
  input: { address?: string; coords?: LngLat; mode: TravelMode },
  geo: Pick<GeoService, "geocode" | "nearby">,
  mapOrigin: LngLat | null,
): Promise<Output<"nearby_15min">> {
  const origin = input.coords ?? (input.address ? (await resolveAddress(geo, input.address)).coords : mapOrigin);
  if (!origin) throw new ToolError("No starting point. Ask the user for an address or to pick a point on the map.");
  return geo.nearby({ origin, mode: input.mode, minutes: 15 });
}
