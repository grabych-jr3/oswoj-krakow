import { describe, expect, it, vi } from "vitest";
import { ToolOutputs } from "@/contracts/chat";
import { type GeocodeResult, type GeoService, NearbyResult } from "@/contracts/geo";
import { Place } from "@/contracts/place";
import nearbyJson from "@/contracts/fixtures/nearby.sample.json";
import placesJson from "@/contracts/fixtures/places.sample.json";
import { ToolError } from "./errors";
import { getProcedure } from "../kb/procedures";
import { procedureForModel, runGetProcedure, runGetScenario, runSearchProcedures, scenarioForModel } from "./knowledge";
import { runFindPlaces, runGeocode, runNearby } from "./places";

// A stub instead of the zone A service keeps these tests independent of how A's data evolves.
const places = Place.array().parse(placesJson);
const nearbyFixture = NearbyResult.parse(nearbyJson);
const wielicka: GeocodeResult = {
  label: "ul. Wielicka 28A, 30-552 Kraków",
  coords: [19.9655, 50.0389],
  district: { number: 13, name: "Podgórze" },
  precision: "address",
};

function stubGeo(): GeoService {
  return {
    geocode: vi.fn(async (query: string) => (query.toLowerCase().includes("wielicka") ? [wielicka] : [])),
    findPlaces: vi.fn(async ({ near, limit = 10 }) =>
      places.slice(0, limit).map((p) => ({ ...p, distanceM: near ? 100 : null })),
    ),
    nearby: vi.fn(async ({ origin, mode }) => ({ ...nearbyFixture, origin: { label: "x", coords: origin }, mode })),
    getPlace: vi.fn(async (id: string) => places.find((p) => p.id === id) ?? null),
    getDistrict: vi.fn(async () => null),
  };
}

describe("search_procedures", () => {
  it("returns hits in the contract shape", () => {
    const output = runSearchProcedures({ query_pl: "zameldowanie" });
    expect(ToolOutputs.search_procedures.parse(output).hits.length).toBeGreaterThan(0);
  });
});

describe("get_procedure", () => {
  it("fills office coords from the urzad layer and leaves unknown offices null", async () => {
    const { procedure } = await runGetProcedure({ symbol: "sa 34" }, stubGeo());
    expect(ToolOutputs.get_procedure.safeParse({ procedure }).success).toBe(true);
    const byId = Object.fromEntries(procedure.offices.map((o) => [o.id, o.coords]));
    expect(byId["urzad:ul_wielicka_28a"]).not.toBeNull();
    expect(byId["urzad:os_zgody_2"]).toBeNull();
  });

  it("keeps coords null when the geo lookup fails", async () => {
    const geo = stubGeo();
    vi.mocked(geo.getPlace).mockRejectedValue(new Error("down"));
    const { procedure } = await runGetProcedure({ symbol: "SA-34" }, geo);
    expect(procedure.offices.every((o) => o.coords === null)).toBe(true);
  });

  it("shows the model a compact card that keeps the facts an answer needs", async () => {
    const output = await runGetProcedure({ symbol: "SA-34" }, stubGeo());
    const forModel = procedureForModel(output);
    expect(JSON.stringify(forModel).length).toBeLessThan(JSON.stringify(output).length * 0.7);
    expect(forModel.bipUrl).toBe(output.procedure.bipUrl);
    expect(forModel.offices.map((o) => o.hours)).toEqual(output.procedure.offices.map((o) => o.hours));
    expect(forModel.oplaty).toContain("17");
  });

  it("throws a ToolError for an unknown symbol", async () => {
    await expect(runGetProcedure({ symbol: "XX-1" }, stubGeo())).rejects.toBeInstanceOf(ToolError);
  });
});

describe("get_scenario", () => {
  it("uses the request locale unless the model asks for another", () => {
    expect(runGetScenario({ id: "praca" }, "uk").scenario.locale).toBe("uk");
    expect(runGetScenario({ id: "praca", locale: "en" }, "uk").scenario.locale).toBe("en");
  });

  it("throws a ToolError for an unknown id", () => {
    expect(() => runGetScenario({ id: "nope" }, "pl")).toThrow(ToolError);
  });

  it("shows the model the real BIP title of every referenced procedure", () => {
    const forModel = scenarioForModel(runGetScenario({ id: "obywatel-ua" }, "uk"));
    const gup1 = forModel.procedures.find((p) => p.symbol === "GUP-1");
    expect(gup1?.title).toBe(getProcedure("GUP-1")!.title);
    expect(gup1?.bipUrl).toMatch(/^https:\/\/www\.bip\.krakow\.pl\//);
  });
});

describe("find_places", () => {
  it("geocodes the address, numbers markers from 1 and matches the contract", async () => {
    const geo = stubGeo();
    const output = await runFindPlaces({ categories: ["przedszkole"], address: "Wielicka 28", limit: 3 }, geo);
    expect(output.center).toEqual(wielicka.coords);
    expect(output.places.map((p) => p.label)).toEqual(["1", "2", "3"]);
    expect(vi.mocked(geo.findPlaces).mock.calls[0][0].near).toEqual(wielicka.coords);
    expect(ToolOutputs.find_places.safeParse(output).success).toBe(true);
  });

  it("resolves a district name to its number, preferring an exact name", async () => {
    const geo = stubGeo();
    const names: Record<number, string> = { 11: "Podgórze Duchackie", 13: "Podgórze", 14: "Czyżyny" };
    vi.mocked(geo.getDistrict).mockImplementation(async (n) =>
      typeof n === "number" && names[n]
        ? ({ number: n, name: names[n], residents: null, foreigners: null, topCitizenships: [], places: {} } as never)
        : null,
    );
    const districtFor = async (district: string) => {
      vi.mocked(geo.findPlaces).mockClear();
      await runFindPlaces({ categories: ["zlobek"], district }, geo);
      return vi.mocked(geo.findPlaces).mock.calls[0][0].district;
    };
    expect(await districtFor("Podgórze")).toBe(13);
    expect(await districtFor("podgorze")).toBe(13);
    expect(await districtFor("Dzielnica Podgórze")).toBe(13);
    expect(await districtFor("Podgórze Duchackie")).toBe(11);
    expect(await districtFor("Duchackie")).toBe(11);
    expect(await districtFor("13")).toBe(13);
    await expect(runFindPlaces({ categories: ["zlobek"], district: "Atlantyda" }, geo)).rejects.toBeInstanceOf(ToolError);
  });

  it("works without a center", async () => {
    const output = await runFindPlaces({ categories: ["park"], district: 13 }, stubGeo());
    expect(output.center).toBeNull();
  });

  it("throws a ToolError for an unknown address", async () => {
    await expect(runFindPlaces({ categories: ["park"], address: "Nowhere 1" }, stubGeo())).rejects.toBeInstanceOf(ToolError);
  });
});

describe("nearby_15min", () => {
  it("prefers coords, then address, then the map origin", async () => {
    const geo = stubGeo();
    await runNearby({ coords: [19.9, 50.0], mode: "walk" }, geo, [1, 1]);
    await runNearby({ address: "Wielicka 28", mode: "transit" }, geo, [1, 1]);
    await runNearby({ mode: "walk" }, geo, [1, 1]);
    const origins = vi.mocked(geo.nearby).mock.calls.map(([q]) => q.origin);
    expect(origins).toEqual([[19.9, 50.0], wielicka.coords, [1, 1]]);
  });

  it("throws a ToolError without any starting point", async () => {
    await expect(runNearby({ mode: "walk" }, stubGeo(), null)).rejects.toBeInstanceOf(ToolError);
  });
});

describe("geocode", () => {
  it("returns results in the contract shape", async () => {
    const output = await runGeocode({ query: "Wielicka" }, stubGeo());
    expect(ToolOutputs.geocode.parse(output).results).toHaveLength(1);
  });
});
