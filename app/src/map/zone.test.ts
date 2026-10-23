import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { describe, expect, it } from "vitest";
import nearbyFixture from "@/contracts/fixtures/nearby.sample.json";
import type { LngLat } from "@/contracts/common";
import type { NearbyResult } from "@/contracts/geo";
import { zoneCovering } from "./zone";

const area = nearbyFixture.area as NearbyResult["area"];
const inside = (p: LngLat, a: NearbyResult["area"]) => booleanPointInPolygon(p, a as GeoJSON.Feature<GeoJSON.Polygon>);

describe("zoneCovering", () => {
  it("leaves a zone that already covers every place untouched", async () => {
    const pts = nearbyFixture.places.map((p) => p.coords as LngLat).filter((p) => inside(p, area));
    expect(await zoneCovering(area, pts)).toBe(area);
  });

  it("adds the hexagon of a reachable place lying outside the zone", async () => {
    const outside: LngLat = [nearbyFixture.origin.coords[0] + 0.03, nearbyFixture.origin.coords[1]];
    expect(inside(outside, area)).toBe(false);
    const grown = await zoneCovering(area, [outside]);
    expect(inside(outside, grown)).toBe(true);
    expect(inside(nearbyFixture.origin.coords as LngLat, grown)).toBe(true);
    expect(grown.properties).toEqual(area.properties);
  });
});
