import { cellToLatLng, gridDisk, latLngToCell } from "h3-js";
import { describe, expect, it } from "vitest";
import type { LngLat } from "@/contracts/common";
import { NearbyResult } from "@/contracts/geo";
import accessJson from "../../../data/geo/access.json";
import { access, createAccess, type AccessData } from "./access";
import { samplePlaces } from "./mock";

const WIELICKA_28: LngLat = [19.965631, 50.040222];
const RYNEK: LngLat = [19.9373, 50.0617];
const OUTSIDE: LngLat = [19.8, 50.25];

describe("15 minutes (real data)", () => {
  it("returns a contract-valid result with the office next door", () => {
    const result = NearbyResult.parse(access.nearby({ origin: WIELICKA_28, mode: "walk" }));
    expect(result.area.geometry.type).toBe("MultiPolygon");
    expect(result.places.some((p) => p.id === "urzad:ul_wielicka_28a" && (p.minutes ?? 99) <= 5)).toBe(true);
    const minutes = result.places.map((p) => p.minutes ?? 0);
    expect(minutes.every((m) => m <= 15)).toBe(true);
    expect(result.method).toContain("r5py");
  });

  it("labels the origin with the nearest address, else with coordinates", () => {
    expect(access.nearby({ origin: WIELICKA_28, mode: "walk" }).origin.label).toBe("ul. Wielicka 28, 30-552 Kraków");
    expect(access.nearby({ origin: OUTSIDE, mode: "walk" }).origin.label).toBe("50.25000, 19.80000");
  });

  it("reaches at least as much by transit as on foot", () => {
    for (const origin of [WIELICKA_28, RYNEK]) {
      const walk = access.nearby({ origin, mode: "walk" });
      const transit = access.nearby({ origin, mode: "transit" });
      const total = (r: NearbyResult) => Object.values(r.counts).reduce((s, n) => s + n, 0);
      expect(total(transit)).toBeGreaterThanOrEqual(total(walk));
      expect(transit.area.properties.cells).toBeGreaterThanOrEqual(walk.area.properties.cells);
    }
  });

  it("has every base group within 15 minutes of the Main Square", () => {
    const result = access.nearby({ origin: RYNEK, mode: "walk" });
    expect(result.score).toEqual({ value: 100, missing: [] });
  });

  it("lists at most 10 places per category, counts all, and filters categories", () => {
    const all = access.nearby({ origin: RYNEK, mode: "transit" });
    const perCategory: Record<string, number> = {};
    for (const p of all.places) perCategory[p.category] = (perCategory[p.category] ?? 0) + 1;
    for (const [c, n] of Object.entries(perCategory)) {
      expect(n).toBeLessThanOrEqual(10);
      expect(all.counts[c]).toBeGreaterThanOrEqual(n);
    }
    const stops = access.nearby({ origin: RYNEK, mode: "walk", categories: ["przystanek"] });
    expect(stops.places.every((p) => p.category === "przystanek")).toBe(true);
    expect(Object.keys(stops.counts)).toEqual(["przystanek"]);
    expect(stops.score.value).toBe(100); // the score always describes the whole zone
  });

  it("answers outside Kraków without failing", () => {
    const result = NearbyResult.parse(access.nearby({ origin: OUTSIDE, mode: "walk" }));
    expect(result.places).toEqual([]);
    expect(result.score.value).toBe(0);
    expect(result.method).toContain("outside Kraków");
  });

  it("is fast: well under 200 ms per call", () => {
    access.nearby({ origin: RYNEK, mode: "transit" }); // warm-up
    const started = performance.now();
    for (let i = 0; i < 20; i++) access.nearby({ origin: [19.93 + i * 0.003, 50.05 + i * 0.001], mode: "transit" });
    expect((performance.now() - started) / 20).toBeLessThan(200);
  });
});

describe("createAccess", () => {
  it("uses a neighbouring cell when the point's own cell is not in the grid", () => {
    const cell = latLngToCell(50.06, 19.94, 9);
    const neighbour = gridDisk(cell, 1).find((c) => c !== cell)!;
    const data: AccessData = {
      res: 9, minutes: 15, method: "test",
      cells: [cell],
      modes: { walk: [{ c: [0], p: [] }], transit: [{ c: [0], p: [] }] },
    };
    const [lat, lng] = cellToLatLng(neighbour);
    const result = createAccess(data, []).nearby({ origin: [lng, lat], mode: "walk" });
    expect(result.method).toBe("test");
    expect(result.area.properties.cells).toBe(2); // the point's own cell plus the grid cell's zone
    const far = createAccess(data, []).nearby({ origin: [19.0, 50.5], mode: "walk" });
    expect(far.method).toContain("outside Kraków");
  });

  it("answers an unroutable cell from its neighbour and keeps the own cell in the zone", () => {
    const own = latLngToCell(50.06, 19.94, 9);
    const neighbour = gridDisk(own, 1).find((c) => c !== own)!;
    const data: AccessData = {
      res: 9, minutes: 15, method: "test",
      cells: [own, neighbour],
      // the router could not snap the own cell (river bank): no reach at all
      modes: { walk: [{ c: [], p: [] }, { c: [1], p: [[0, 3]] }], transit: [{ c: [], p: [] }, { c: [1], p: [[0, 3]] }] },
    };
    const [lat, lng] = cellToLatLng(own);
    const result = createAccess(data, samplePlaces.slice(0, 1)).nearby({ origin: [lng, lat], mode: "walk" });
    expect(result.places.map((p) => [p.id, p.minutes])).toEqual([[samplePlaces[0].id, 3]]);
    expect(result.area.properties.cells).toBe(2); // the neighbour's zone plus the own cell
  });
});

describe("real grid edge cases", () => {
  const data = accessJson as unknown as AccessData;

  // 2 cells could not be snapped to a street, 17 do not reach their own centre (steelworks in Nowa Huta)
  it("gives every grid cell an answer whose zone holds the cell itself", () => {
    for (const mode of ["walk", "transit"] as const) {
      data.cells.forEach((cell, i) => {
        const r = data.modes[mode][i];
        if (r.c.includes(i)) return; // the common case, covered above
        const [lat, lng] = cellToLatLng(cell);
        const result = access.nearby({ origin: [lng, lat], mode });
        expect(result.method).not.toContain("outside Kraków");
        if (r.c.length || r.p.length) {
          // own reach, with the own cell added to the zone
          expect(result.area.properties.cells).toBe(new Set([cell, ...r.c.map((j) => data.cells[j])]).size);
        } else {
          // no data at all: a neighbour answers, the own cell is still in the zone
          expect(result.area.properties.cells).toBeGreaterThan(1);
        }
      });
    }
  });
});
