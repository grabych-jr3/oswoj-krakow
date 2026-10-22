import { z } from "zod";
import type { LngLat } from "@/contracts/common";
import { GeocodeResult, NearbyResult, type TravelMode } from "@/contracts/geo";

/** Why a lookup failed: the point is outside Kraków (HTTP 400) or anything else. */
export class NearbyError extends Error {
  constructor(readonly kind: "outside" | "failed") {
    super(kind);
  }
}

/** Address suggestions from GET /api/geocode (zone A, contract GeocodeResult[]). */
export async function fetchGeocode(q: string, signal?: AbortSignal, limit = 5): Promise<GeocodeResult[]> {
  const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}&limit=${limit}`, { signal });
  if (!res.ok) throw new NearbyError("failed");
  const parsed = z.array(GeocodeResult).safeParse(await res.json());
  if (!parsed.success) throw new NearbyError("failed");
  return parsed.data;
}

// The box /api/nearby accepts (Kraków with a margin): farther points fail without a request.
const BOUNDS = { minLng: 19.5, maxLng: 20.5, minLat: 49.8, maxLat: 50.3 };

/** What is within 15 minutes of a point, from GET /api/nearby (zone A, contract NearbyResult). */
export async function fetchNearby(coords: LngLat, mode: TravelMode, signal?: AbortSignal): Promise<NearbyResult> {
  const [lng, lat] = coords;
  if (lng < BOUNDS.minLng || lng > BOUNDS.maxLng || lat < BOUNDS.minLat || lat > BOUNDS.maxLat) throw new NearbyError("outside");
  const res = await fetch(`/api/nearby?lng=${lng}&lat=${lat}&mode=${mode}`, { signal });
  if (res.status === 400) throw new NearbyError("outside");
  if (!res.ok) throw new NearbyError("failed");
  const parsed = NearbyResult.safeParse(await res.json());
  if (!parsed.success) {
    console.warn("[15min] /api/nearby does not match the contract", parsed.error.issues.slice(0, 3));
    throw new NearbyError("failed");
  }
  return parsed.data;
}

/** Shareable link to a 15-minute view: /<locale>/mapa?lng=…&lat=…&mode=… */
export function nearbyLink(base: string, coords: LngLat, mode: TravelMode): string {
  const url = new URL(base);
  url.searchParams.set("lng", coords[0].toFixed(5));
  url.searchParams.set("lat", coords[1].toFixed(5));
  url.searchParams.set("mode", mode);
  url.searchParams.delete("q");
  return url.toString();
}
