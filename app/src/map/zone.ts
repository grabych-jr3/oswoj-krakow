import type { LngLat } from "@/contracts/common";
import type { NearbyResult } from "@/contracts/geo";

type Area = NearbyResult["area"];

/** The 15-minute grid of zone A (A8, H3 resolution 9). */
const H3_RES = 9;

/**
 * The 15-minute zone, grown to cover every place reported as reachable. The zone is the set of
 * reachable H3 cells, so the cell of a reachable place belongs in it; some results leave a place up
 * to a few hundred metres outside its zone, and on the map that looks like an error. The missing
 * cells are added from the same grid. Libraries load only when a 15-minute view is shown.
 */
export async function zoneCovering(area: Area, points: LngLat[]): Promise<Area> {
  if (!points.length) return area;
  const [{ booleanPointInPolygon }, { union }, { featureCollection, polygon }, h3] = await Promise.all([
    import("@turf/boolean-point-in-polygon"),
    import("@turf/union"),
    import("@turf/helpers"),
    import("h3-js"),
  ]);
  const zone = area as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
  const outside = points.filter((p) => !booleanPointInPolygon(p, zone));
  if (!outside.length) return area;

  const cells = [...new Set(outside.map(([lng, lat]) => h3.latLngToCell(lat, lng, H3_RES)))];
  const hexagons = cells.map((cell) => {
    const ring = h3.cellToBoundary(cell, true);
    return polygon([[...ring, ring[0]]]);
  });
  const merged = union(featureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon>([zone, ...hexagons]));
  if (!merged) return area;
  return { type: "Feature", geometry: merged.geometry as Area["geometry"], properties: area.properties };
}
