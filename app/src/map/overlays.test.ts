import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAccessIndex, fetchDistricts } from "./overlays";

afterEach(() => vi.unstubAllGlobals());

// Serve the real data files of zone A from public/.
function serveFile(path: string) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(readFileSync(`public${path}`, "utf8"), { status: 200 })));
}

describe("fetchAccessIndex", () => {
  it("turns every H3 cell into a closed hexagon with walk and transit scores", async () => {
    serveFile("/data/layers/access-index.json");
    const { cells, method } = await fetchAccessIndex();
    expect(method).toMatch(/r5py|osmnx/);
    expect(cells.features.length).toBeGreaterThan(3000);
    const [first] = cells.features;
    const ring = first.geometry.coordinates[0];
    expect(ring.length).toBe(7); // 6 corners + closing point
    expect(ring[0]).toEqual(ring[6]);
    const [lng, lat] = ring[0];
    expect(lng).toBeGreaterThan(19.7);
    expect(lng).toBeLessThan(20.3);
    expect(lat).toBeGreaterThan(49.9);
    expect(lat).toBeLessThan(50.2);
    for (const f of cells.features.slice(0, 50)) {
      expect(f.properties.walk).toBeGreaterThanOrEqual(0);
      expect(f.properties.transit).toBeLessThanOrEqual(100);
    }
  });
});

describe("fetchDistricts", () => {
  it("returns the 18 districts with statistics that match the contract", async () => {
    serveFile("/data/layers/districts.geojson");
    const { features } = await fetchDistricts();
    expect(features).toHaveLength(18);
    expect(features.map((f) => f.properties.number).sort((a, b) => a - b)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
    expect(features[0].properties.topCitizenships.length).toBeLessThanOrEqual(5);
  });

  it("rejects a file off the contract", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ features: [{ type: "Feature" }] }))));
    await expect(fetchDistricts()).rejects.toThrow();
  });
});
