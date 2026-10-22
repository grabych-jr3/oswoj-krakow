// GET /api/nearby?lng=…&lat=…&mode=walk|transit[&categories=a,b] → NearbyResult (contracts/geo.ts).
import { NextRequest, NextResponse } from "next/server";
import { TravelMode } from "@/contracts/geo";
import { PlaceCategory } from "@/contracts/place";
import { geo } from "@/server/geo";

// A generous box around Kraków: farther points are a client error, not "nothing nearby".
const BOUNDS = { minLng: 19.5, maxLng: 20.5, minLat: 49.8, maxLat: 50.3 };
const CACHE = { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" };

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const lng = Number(params.get("lng"));
  const lat = Number(params.get("lat"));
  if (!params.has("lng") || !params.has("lat") || !Number.isFinite(lng) || !Number.isFinite(lat)) {
    return bad("lng and lat must be numbers");
  }
  if (lng < BOUNDS.minLng || lng > BOUNDS.maxLng || lat < BOUNDS.minLat || lat > BOUNDS.maxLat) {
    return bad("the point is not in or near Kraków");
  }
  const mode = TravelMode.safeParse(params.get("mode") ?? "walk");
  if (!mode.success) return bad("mode must be walk or transit");
  const rawCategories = params.get("categories");
  const categories = rawCategories
    ? PlaceCategory.array().safeParse(rawCategories.split(",").map((c) => c.trim()).filter(Boolean))
    : null;
  if (categories && !categories.success) return bad("unknown category in categories");

  const result = await geo.nearby({ origin: [lng, lat], mode: mode.data, categories: categories?.data });
  return NextResponse.json(result, { headers: CACHE });
}
