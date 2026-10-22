import { afterEach, describe, expect, it, vi } from "vitest";
import nearbyFixture from "@/contracts/fixtures/nearby.sample.json";
import { indexGroups } from "@/lib/fifteen";
import { fetchGeocode, fetchNearby, NearbyError, nearbyLink } from "./nearby";

afterEach(() => vi.unstubAllGlobals());

const respond = (status: number, body: unknown) =>
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status })));

describe("indexGroups", () => {
  it("marks the six index groups present or missing from the counts", () => {
    const groups = indexGroups({ zlobek: 0, klub_dzieciecy: 2, przedszkole: 3, park_kieszonkowy: 1, przystanek: 4 });
    expect(Object.fromEntries(groups.map((g) => [g.id, g.present]))).toEqual({
      care: true,
      przedszkole: true,
      school: false,
      green: true,
      library: false,
      stop: true,
    });
  });
});

describe("nearbyLink", () => {
  it("builds a shareable link and drops a chat question", () => {
    const link = nearbyLink("https://x.pl/pl/mapa?q=hej", [19.965634, 50.040221], "transit");
    expect(link).toBe("https://x.pl/pl/mapa?lng=19.96563&lat=50.04022&mode=transit");
  });
});

describe("fetchNearby", () => {
  it("returns a result that matches the contract", async () => {
    respond(200, nearbyFixture);
    await expect(fetchNearby([19.96, 50.04], "walk")).resolves.toMatchObject({ minutes: 15 });
  });

  it("tells a point outside Kraków from other failures", async () => {
    respond(400, { error: "the point is not in or near Kraków" });
    await expect(fetchNearby([21, 50], "walk")).rejects.toEqual(new NearbyError("outside"));
    respond(500, {});
    await expect(fetchNearby([19.9, 50], "walk")).rejects.toMatchObject({ kind: "failed" });
    respond(200, { nope: true });
    await expect(fetchNearby([19.9, 50], "walk")).rejects.toMatchObject({ kind: "failed" });
  });
});

describe("fetchGeocode", () => {
  it("returns suggestions and rejects a response off the contract", async () => {
    const hit = { label: "ul. Wielicka 28, 30-552 Kraków", coords: [19.96563, 50.04022], district: null, precision: "address" };
    respond(200, [hit]);
    await expect(fetchGeocode("Wielicka 28")).resolves.toEqual([hit]);
    respond(200, [{ label: 1 }]);
    await expect(fetchGeocode("x")).rejects.toMatchObject({ kind: "failed" });
  });
});
