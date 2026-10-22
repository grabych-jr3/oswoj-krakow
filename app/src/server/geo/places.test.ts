import { describe, expect, it } from "vitest";
import { Place } from "@/contracts/place";
import { geo } from "./index";
import { places } from "./places";

const WIELICKA_28: [number, number] = [19.965631, 50.040222];

describe("places (real layers)", () => {
  it("gets places by id, including offices by B's id", () => {
    expect(places.getPlace("urzad:ul_wielicka_28a")?.category).toBe("urzad");
    expect(places.getPlace("przedszkole:rspo-5034")?.address).toContain("Wielicka");
    expect(places.getPlace("nope:1")).toBeNull();
  });

  it("finds places of a category near a point, nearest first, within the radius", () => {
    const found = places.findPlaces({ categories: ["przedszkole"], near: WIELICKA_28, radiusM: 1000 });
    expect(found.length).toBeGreaterThan(3);
    expect(found.every((p) => p.category === "przedszkole" && p.distanceM !== null && p.distanceM <= 1000)).toBe(true);
    const d = found.map((p) => p.distanceM!);
    expect(d).toEqual([...d].sort((a, b) => a - b));
    for (const p of found) Place.parse(p);
  });

  it("filters by district and by words of the name, without Polish letters", () => {
    const skrzaty = places.findPlaces({ categories: [], text: "skrzaty" });
    expect(skrzaty.some((p) => p.id === "przedszkole:rspo-5034")).toBe(true);
    expect(places.findPlaces({ categories: ["biblioteka"], text: "glowna" })[0].name).toContain("Biblioteka Główna");
    const podgorze = places.findPlaces({ categories: ["park"], district: 13, limit: 50 });
    expect(podgorze.length).toBeGreaterThan(3);
    expect(podgorze.every((p) => p.district?.number === 13 && p.distanceM === null)).toBe(true);
  });

  it("treats an empty category list as all categories and respects the limit", () => {
    const all = places.findPlaces({ categories: [], near: WIELICKA_28, radiusM: 500, limit: 50 });
    expect(new Set(all.map((p) => p.category)).size).toBeGreaterThan(2);
    expect(places.findPlaces({ categories: [], limit: 3 })).toHaveLength(3);
  });
});

describe("GeoService (GEO_IMPL=real)", () => {
  it("answers every method from real data", async () => {
    expect((await geo.geocode("wielicka 28", 1))[0].label).toBe("ul. Wielicka 28, 30-552 Kraków");
    expect((await geo.getPlace("urzad:ul_wielicka_28a"))?.category).toBe("urzad");
    expect((await geo.findPlaces({ categories: ["przystanek"], near: WIELICKA_28, radiusM: 400 })).length).toBeGreaterThan(0);
    expect((await geo.getDistrict(WIELICKA_28))?.name).toBe("Podgórze");
    expect((await geo.nearby({ origin: WIELICKA_28, mode: "walk" })).method).toContain("r5py");
  });
});
