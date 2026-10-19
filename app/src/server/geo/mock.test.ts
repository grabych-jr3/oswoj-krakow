import { describe, expect, it } from "vitest";
import type { LngLat } from "@/contracts/common";
import { GeocodeResult, NearbyResult } from "@/contracts/geo";
import { DistrictStats, Place } from "@/contracts/place";
import {
  createMockGeoService,
  distanceM,
  estimateNearby,
  inPolygon,
  sampleDistrict,
  sampleNearby,
  samplePlaces,
} from "./mock";

const geo = createMockGeoService();
const origin = sampleNearby.origin.coords;
// Reference points checked against the full MSIP district layer.
const PLAC_NOWY: LngLat = [19.9446, 50.0515]; // I Stare Miasto, ~600 m across the Vistula from the fixtures
const KOPIEC_KRAKUSA: LngLat = [19.9585, 50.0381]; // XIII Podgórze, no fixture place nearby

/** Twice the signed area of a ring; positive = counterclockwise. */
const signedArea = (ring: LngLat[]) =>
  ring.slice(0, -1).reduce((s, [x1, y1], i) => s + x1 * ring[i + 1][1] - ring[i + 1][0] * y1, 0);

describe("geo fixtures", () => {
  it("has 12 places across at least 10 categories with unique ids", () => {
    expect(samplePlaces).toHaveLength(12);
    expect(new Set(samplePlaces.map((p) => p.category)).size).toBeGreaterThanOrEqual(10);
    expect(new Set(samplePlaces.map((p) => p.id)).size).toBe(12);
    for (const p of samplePlaces) expect(p.id.startsWith(`${p.category}:`)).toBe(true);
  });

  it("puts every place inside its district boundary", () => {
    for (const p of samplePlaces) {
      expect(p.district?.number).toBe(sampleDistrict.properties.number);
      expect(inPolygon(p.coords, sampleDistrict.geometry.coordinates)).toBe(true);
    }
    expect(signedArea(sampleDistrict.geometry.coordinates[0])).toBeGreaterThan(0);
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
    expect(results.every((r) => r.district?.number === 13)).toBe(true);
    expect((await geo.geocode("ul. dabrowki")).length).toBe(1);
    expect(await geo.geocode("   ")).toEqual([]);
  });

  it("geocodes only street addresses, not parks, stops or P+R", async () => {
    expect(await geo.geocode("bednarskiego")).toEqual([]);
    expect(await geo.geocode("podgorze ska")).toEqual([]);
    expect(await geo.geocode("maly plaszow")).toEqual([]);
    expect(await geo.geocode("parkowa")).toHaveLength(1); // a real street address still matches
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
    const transit = await geo.nearby({ origin, mode: "transit", categories: ["przystanek"] });
    expect(transit.mode).toBe("transit");
    expect(transit.area.properties.mode).toBe("transit");
    expect(transit.method).toContain("transit not modelled");
    expect(transit.places.every((p) => p.category === "przystanek")).toBe(true);
    expect(Object.keys(transit.counts)).toEqual(["przystanek"]);
  });

  it("matches the fixture when estimating around the fixture origin", () => {
    const estimate = estimateNearby(samplePlaces, origin);
    expect(estimate.places.map((p) => [p.id, p.minutes])).toEqual(sampleNearby.places.map((p) => [p.id, p.minutes]));
    expect(estimate.counts).toEqual(sampleNearby.counts);
    expect(estimate.score).toEqual(sampleNearby.score);
    expect(estimate.area.geometry).toEqual(sampleNearby.area.geometry);
  });

  it("computes the zone around any other origin", async () => {
    const elsewhere: LngLat = [19.9475, 50.0425]; // between the park and the library
    const result = NearbyResult.parse(await geo.nearby({ origin: elsewhere, mode: "walk" }));
    expect(result.origin.coords).toEqual(elsewhere);
    expect(result.places[0].id).not.toBe(sampleNearby.places[0].id);
    const ring = result.area.geometry.coordinates[0] as LngLat[];
    expect(signedArea(ring)).toBeGreaterThan(0);
    const center = ring.slice(0, -1).reduce((s, p) => [s[0] + p[0] / 16, s[1] + p[1] / 16], [0, 0]);
    expect(distanceM(center as LngLat, elsewhere)).toBeLessThan(5);
    expect((await geo.nearby({ origin: [19.8, 50.2], mode: "walk" })).places).toEqual([]);
  });

  it("lists at most 10 places per category but counts all of them", () => {
    const preschool = samplePlaces.find((p) => p.category === "przedszkole")!;
    const many = Array.from({ length: 12 }, (_, i) => ({ ...preschool, id: `przedszkole:test-${i}`, coords: origin }));
    const result = estimateNearby(many, origin);
    expect(result.places).toHaveLength(10);
    expect(result.counts.przedszkole).toBe(12);
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
    expect((await geo.getDistrict(KOPIEC_KRAKUSA))?.number).toBe(13);
    expect(await geo.getDistrict(1)).toBeNull();
    expect(await geo.getDistrict(PLAC_NOWY)).toBeNull(); // across the river: not Podgórze, even though close
    expect(await geo.getDistrict([19.8, 50.2])).toBeNull();
  });

  it("measures distance in metres", () => {
    expect(Math.round(distanceM([19.96, 50.04], [19.96, 50.05]))).toBe(1112);
  });
});
