import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { NearbyResult } from "@/contracts/geo";
import { GET } from "./route";

const call = (query: string) => GET(new NextRequest(`http://localhost/api/nearby${query}`));

describe("GET /api/nearby", () => {
  it("returns a NearbyResult for a point in Kraków (walk by default)", async () => {
    const res = await call("?lng=19.965631&lat=50.040222");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toContain("s-maxage");
    const body = NearbyResult.parse(await res.json());
    expect(body.mode).toBe("walk");
    expect(body.places.some((p) => p.id === "urzad:ul_wielicka_28a")).toBe(true);
  });

  it("accepts transit and a category filter (spaces after commas too)", async () => {
    const body = NearbyResult.parse(await (await call("?lng=19.9373&lat=50.0617&mode=transit&categories=przystanek,%20park")).json());
    expect(body.mode).toBe("transit");
    expect(body.places.every((p) => p.category === "przystanek" || p.category === "park")).toBe(true);
  });

  it("rejects missing or bad parameters and points far from Kraków", async () => {
    for (const q of ["", "?lng=19.96", "?lng=abc&lat=50.04", "?lng=19.96&lat=50.04&mode=car",
      "?lng=19.96&lat=50.04&categories=kawiarnia", "?lng=21.01&lat=52.23"]) {
      expect((await call(q)).status, q).toBe(400);
    }
  });
});
