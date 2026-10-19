import { describe, expect, it } from "vitest";
import { ChatRequestBody, ToolOutputs } from "@/contracts/chat";
import { NearbyResult } from "@/contracts/geo";
import { Procedure } from "@/contracts/kb";
import { Place, PlaceCategory } from "@/contracts/place";

// Smoke tests: the shared contracts compile and accept/reject representative payloads.
const place = {
  id: "przedszkole:rspo-3786",
  category: "przedszkole",
  name: "Samorządowe Przedszkole nr 14",
  address: "ul. Młyńska Boczna 4, 31-470 Kraków",
  coords: [19.96, 50.07],
  district: { number: 3, name: "Prądnik Czerwony" },
  phone: "12 411 74 30",
  url: null,
  attrs: { rspo: 3786, children: 108, groups: 8, public: true },
  source: {
    dataset: "przedszkola-w-krakowie-liczba-dzieci",
    url: "https://otwartedane.um.krakow.pl/zbiory-danych/przedszkola-w-krakowie-liczba-dzieci",
    updatedAt: "2025-09-30",
  },
};

describe("contracts", () => {
  it("accepts a valid Place", () => {
    expect(Place.parse(place).id).toBe("przedszkole:rspo-3786");
  });

  it("rejects an unknown category", () => {
    expect(Place.safeParse({ ...place, category: "kawiarnia" }).success).toBe(false);
  });

  it("includes the MVP map categories", () => {
    for (const c of ["zlobek", "przedszkole", "szkola_podstawowa", "biblioteka", "park", "przystanek", "urzad"]) {
      expect(PlaceCategory.options).toContain(c);
    }
  });

  it("accepts a NearbyResult", () => {
    const result = NearbyResult.parse({
      origin: { label: "ul. Wielicka 28, 30-552 Kraków", coords: [19.96, 50.04] },
      mode: "walk",
      minutes: 15,
      area: { type: "Feature", geometry: { type: "Polygon", coordinates: [] }, properties: {} },
      counts: { przedszkole: 1 },
      places: [{ ...place, minutes: 7 }],
      score: { value: 50, missing: ["biblioteka"] },
      method: "test",
    });
    expect(result.places[0].minutes).toBe(7);
  });

  it("requires all Procedure sections", () => {
    expect(
      Procedure.safeParse({
        symbol: "SA-34",
        title: "Nadanie numeru PESEL na wniosek",
        bipUrl: "https://www.bip.krakow.pl/uslugi/SA-34",
        department: null,
        version: null,
        publishedAt: null,
        tags: ["cudzoziemiec"],
        relevance: 1,
        sections: {},
        offices: [],
        attachments: [],
      }).success,
    ).toBe(false);
  });

  it("exposes the agreed tool names", () => {
    expect(Object.keys(ToolOutputs).sort()).toEqual(
      ["find_places", "geocode", "get_procedure", "get_scenario", "nearby_15min", "search_procedures"].sort(),
    );
    expect(ChatRequestBody.safeParse({ messages: [], locale: "uk" }).success).toBe(true);
  });
});
