import { describe, expect, it } from "vitest";
import { GeocodeResult, NearbyResult } from "@/contracts/geo";
import { DistrictStats, Place } from "@/contracts/place";
import { createMockGeoService, distanceM, sampleNearby, samplePlaces } from "./mock";

const geo = createMockGeoService();
const origin = sampleNearby.origin.coords;

describe("geo fixtures", () => {
  it("has 12 places across at least 10 categories with unique ids", () => {
    expect(samplePlaces).toHaveLength(12);
    expect(new Set(samplePlaces.map((p) => p.category)).size).toBeGreaterThanOrEqual(10);
    expect(new Set(samplePlaces.map((p) => p.id)).size).toBe(12);
    for (const p of samplePlaces) expect(p.id.startsWith(`${p.category}:`)).toBe(true);
  });

  it("keeps nearby counts and places consistent", () => {
    const counted: Record<string, number> = {};
    for (const p of sampleNearby.places) counted[p.category] = (counted[p.category] ?? 0) + 1;
    expect(sampleNearby.counts).toEqual(counted);
    for (const p of sampleNearby.places) expect(samplePlaces.some((s) => s.id === p.id)).toBe(true);
  });
});

describe("mock GeoService", () => {
  it("geocodes ignoring case and diacritics", async () => {
    const results = await geo.geocode("wielicka 28");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].label).toBe("ul. Wielicka 28, 30-552 Kraków");
    expect(GeocodeResult.array().parse(results)).toHaveLength(results.length);
    expect((await geo.geocode("ul. dabrowki")).length).toBe(1);
    expect(await geo.geocode("   ")).toEqual([]);
  });

  it("finds places within the radius, sorted by distance", async () => {
    const results = await geo.findPlaces({ categories: [], near: origin, radiusM: 1000 });
    expect(results.length).toBeGreaterThan(0);
    for (const p of results) {
      Place.parse(p);
      expect(p.distanceM).not.toBeNull();
      expect(p.distanceM!).toBeLessThanOrEqual(1000);
    }
    const distances = results.map((p) => p.distanceM!);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });

  it("filters by category, text and limit", async () => {
    const preschools = await geo.findPlaces({ categories: ["przedszkole"] });
    expect(preschools).toHaveLength(2);
    expect(preschools.every((p) => p.distanceM === null)).toBe(true);
    expect(await geo.findPlaces({ categories: [], text: "dworek" })).toHaveLength(1);
    expect(await geo.findPlaces({ categories: [], limit: 3 })).toHaveLength(3);
  });

  it("returns a contract-valid nearby result", async () => {
    const result = NearbyResult.parse(await geo.nearby({ origin, mode: "walk" }));
    expect(result.origin.label).toBe(sampleNearby.origin.label);
    const transit = await geo.nearby({ origin: [19.94, 50.06], mode: "transit", categories: ["przystanek"] });
    expect(transit.mode).toBe("transit");
    expect(transit.places.every((p) => p.category === "przystanek")).toBe(true);
    expect(Object.keys(transit.counts)).toEqual(["przystanek"]);
  });

  it("gets a place by id", async () => {
    expect((await geo.getPlace("biblioteka:filia-46"))?.name).toContain("Filia nr 46");
    expect(await geo.getPlace("biblioteka:missing")).toBeNull();
  });

  it("gets a district by number or point", async () => {
    const byNumber = DistrictStats.parse(await geo.getDistrict(13));
    expect(byNumber.name).toBe("Podgórze");
    expect(byNumber.placeCounts.przedszkole).toBe(2);
    expect(byNumber.residents).toBeNull();
    expect((await geo.getDistrict(origin))?.number).toBe(13);
    expect(await geo.getDistrict(1)).toBeNull();
    expect(await geo.getDistrict([19.8, 50.2])).toBeNull();
  });

  it("measures distance in metres", () => {
    expect(Math.round(distanceM([19.96, 50.04], [19.96, 50.05]))).toBe(1112);
  });
});
