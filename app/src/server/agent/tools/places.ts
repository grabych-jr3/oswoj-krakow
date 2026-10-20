// Handlers of the map tools: find_places, nearby_15min, geocode. All geo work is delegated to zone A.
import type { z } from "zod";
import type { ToolOutputs } from "@/contracts/chat";
import type { LngLat } from "@/contracts/common";
import type { GeocodeResult, TravelMode } from "@/contracts/geo";
import type { PlaceCategory } from "@/contracts/place";
import type { GeoService } from "@/server/geo";
import { ToolError } from "./errors";

type Output<Name extends keyof typeof ToolOutputs> = z.infer<(typeof ToolOutputs)[Name]>;

const GEOCODE_LIMIT = 5;

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
    district?: number;
    text?: string;
    limit?: number;
  },
  geo: Pick<GeoService, "geocode" | "findPlaces">,
): Promise<Output<"find_places">> {
  const center = input.near ?? (input.address ? (await resolveAddress(geo, input.address)).coords : null);
  const places = await geo.findPlaces({
    categories: input.categories,
    near: center ?? undefined,
    district: input.district,
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
