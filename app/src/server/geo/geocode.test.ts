import { describe, expect, it } from "vitest";
import { GeocodeResult } from "@/contracts/geo";
import { fold, geocoder, parseQuery, withinOneEdit } from "./geocode";

const top = (q: string, limit = 3) => geocoder.geocode(q, limit).map((r) => r.label);

describe("query parsing", () => {
  it("folds Polish letters and punctuation", () => {
    expect(fold("Generała Łokietka 7/3")).toBe("generala lokietka 7 3");
  });

  it("splits street words, house number, postal code and street kind", () => {
    expect(parseQuery("ul. Wielicka 28a, 30-552 Kraków")).toEqual({ words: ["wielicka"], number: "28a", postal: "30-552", kind: null });
    expect(parseQuery("os. Zgody 2")).toMatchObject({ words: ["zgody"], number: "2", kind: "osiedle" });
    expect(parseQuery("al. 29 Listopada 5")).toMatchObject({ words: ["29", "listopada"], number: "5", kind: "aleja" });
    expect(parseQuery("29 listopada")).toMatchObject({ words: ["29", "listopada"], number: null });
    expect(parseQuery("Limanowskiego 13/5")).toMatchObject({ words: ["limanowskiego"], number: "13" });
    expect(parseQuery("Wielicka 28 a")).toMatchObject({ words: ["wielicka"], number: "28a" });
  });

  it("forgives one typo, including two swapped letters", () => {
    expect(withinOneEdit("wielicak", "wielicka")).toBe(true);
    expect(withinOneEdit("wielcka", "wielicka")).toBe(true);
    expect(withinOneEdit("wieliczka", "wielicka")).toBe(true);
    expect(withinOneEdit("wilecka", "wielicka")).toBe(false);
  });
});

describe("geocoder (EMUiA)", () => {
  it("finds an address and returns contract-valid results", () => {
    const results = geocoder.geocode("wielicka 28", 3);
    expect(GeocodeResult.array().parse(results)).toHaveLength(3);
    expect(results[0]).toMatchObject({ label: "ul. Wielicka 28, 30-552 Kraków", precision: "address",
      district: { number: 13, name: "Podgórze" } });
    expect(results[0].coords[0]).toBeCloseTo(19.9656, 3);
  });

  it("completes the start of a street and of a house number", () => {
    expect(top("wiel")[0]).toBe("ul. Wielicka, Kraków");
    expect(top("wiel 28")[0]).toBe("ul. Wielicka 28, 30-552 Kraków");
    expect(top("wielicka 28")).toEqual(["ul. Wielicka 28, 30-552 Kraków", "ul. Wielicka 28a, 30-552 Kraków",
      "ul. Wielicka 28B, 30-552 Kraków"]);
  });

  it("matches by surname, without Polish letters and with a typo", () => {
    expect(top("kutrzeby 6")[0]).toBe("ul. Generała Tadeusza Kutrzeby 6, 30-515 Kraków");
    expect(top("lobzowska 3")[0]).toBe("ul. Łobzowska 3, 31-144 Kraków");
    expect(top("wielicak 28")[0]).toBe("ul. Wielicka 28, 30-552 Kraków");
  });

  it("tells osiedle from street and handles numbers inside street names", () => {
    expect(top("os. zgody 2")[0]).toBe("os. Zgody 2, 31-949 Kraków");
    expect(top("zgody 2")[0]).toBe("ul. Zgody 2, 31-217 Kraków");
    expect(top("29 listopada")[0]).toBe("al. 29 Listopada, Kraków");
    expect(top("dietla 80")[0]).toBe("ul. Józefa Dietla 80/82, 31-073 Kraków");
  });

  it("answers a full address with postal code and city", () => {
    expect(top("ul. Wielicka 28A, 30-552 Kraków", 1)).toEqual(["ul. Wielicka 28a, 30-552 Kraków"]);
    expect(top("Kraków, Wielicka 28", 1)).toEqual(["ul. Wielicka 28, 30-552 Kraków"]);
  });

  it("ignores the flat and accepts the number before the street", () => {
    expect(top("wielicka 28 m 4", 1)).toEqual(["ul. Wielicka 28, 30-552 Kraków"]);
    expect(top("Wielicka 28 lok. 3", 1)).toEqual(["ul. Wielicka 28, 30-552 Kraków"]);
    expect(top("Zakopiańska 105/12", 1)).toEqual(["ul. Zakopiańska 105, 30-418 Kraków"]);
    expect(top("28 Wielicka", 1)).toEqual(["ul. Wielicka 28, 30-552 Kraków"]);
    expect(top("29 listopada", 1)).toEqual(["al. 29 Listopada, Kraków"]); // a street that starts with a number
  });

  it("returns streets when the number is unknown, nothing for nonsense, and respects the limit", () => {
    expect(geocoder.geocode("wielicka 99999", 2).every((r) => r.precision === "street")).toBe(true);
    expect(geocoder.geocode("xyzqw")).toEqual([]);
    expect(geocoder.geocode("")).toEqual([]);
    expect(geocoder.geocode("wiel", 1)).toHaveLength(1);
    expect(geocoder.geocode("wiel", 0)).toEqual([]);
  });

  it("names a point by the nearest address within 60 m", () => {
    expect(geocoder.reverse([19.965631, 50.040222])).toBe("ul. Wielicka 28, 30-552 Kraków");
    expect(geocoder.reverse([19.9373, 50.0617])).toMatch(/^Rynek Główny \d+/);
    expect(geocoder.reverse([19.8, 50.25])).toBeNull(); // fields outside the city
  });

  it("is fast enough for typing", () => {
    const started = performance.now();
    for (let i = 0; i < 100; i++) geocoder.geocode(["wiel", "kutrzeby 6", "os zgody", "rynek"][i % 4], 5);
    expect((performance.now() - started) / 100).toBeLessThan(20);
  });
});
