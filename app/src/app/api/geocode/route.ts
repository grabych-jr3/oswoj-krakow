// GET /api/geocode?q=…&limit=5 → GeocodeResult[] (contracts/geo.ts). Address autocomplete over EMUiA.
import { NextRequest, NextResponse } from "next/server";
import { geo } from "@/server/geo";

const MIN_QUERY = 2;
const MAX_QUERY = 200;
const MAX_LIMIT = 10;
// The data changes only with a deploy: let the CDN answer repeated queries.
const CACHE = { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" };

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length > MAX_QUERY) {
    return NextResponse.json({ error: `q is longer than ${MAX_QUERY} characters` }, { status: 400 });
  }
  const rawLimit = req.nextUrl.searchParams.get("limit");
  const limit = rawLimit === null ? 5 : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return NextResponse.json({ error: `limit must be an integer 1–${MAX_LIMIT}` }, { status: 400 });
  }
  if (q.length < MIN_QUERY) return NextResponse.json([], { headers: CACHE });
  return NextResponse.json(await geo.geocode(q, limit), { headers: CACHE });
}
