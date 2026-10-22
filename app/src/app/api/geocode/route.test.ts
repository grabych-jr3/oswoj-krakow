import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { GeocodeResult } from "@/contracts/geo";
import { GET } from "./route";

const call = (query: string) => GET(new NextRequest(`http://localhost/api/geocode${query}`));

describe("GET /api/geocode", () => {
  it("returns GeocodeResult[] with a CDN cache header", async () => {
    const res = await call("?q=wielicka%2028&limit=2");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toContain("s-maxage");
    const body = GeocodeResult.array().parse(await res.json());
    expect(body).toHaveLength(2);
    expect(body[0].label).toBe("ul. Wielicka 28, 30-552 Kraków");
  });

  it("answers [] for a query shorter than 2 characters", async () => {
    expect(await (await call("?q=w")).json()).toEqual([]);
    expect(await (await call("")).json()).toEqual([]);
  });

  it("rejects a bad limit or a very long query", async () => {
    for (const q of ["?q=wiel&limit=0", "?q=wiel&limit=11", "?q=wiel&limit=abc", `?q=${"a".repeat(201)}`]) {
      expect((await call(q)).status).toBe(400);
    }
  });
});
