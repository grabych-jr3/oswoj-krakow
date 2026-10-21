import { Place, PlaceCategory } from "@/contracts/place";

/** One entry of /data/layers/index.json (written by zone A, PLAN.md §5.3). */
export type LayerInfo = {
  category: PlaceCategory;
  count: number;
  updatedAt: string | null;
  source: { dataset: string; url: string; updatedAt: string | null }[];
};

type LayerFeature = { type: "Feature"; geometry: { type: "Point"; coordinates: [number, number] }; properties: Omit<Place, "coords"> };

const LAYERS_URL = "/data/layers";

export async function fetchLayerIndex(): Promise<LayerInfo[]> {
  const res = await fetch(`${LAYERS_URL}/index.json`);
  if (!res.ok) throw new Error(`layers index: HTTP ${res.status}`);
  const json = (await res.json()) as { categories: Array<Omit<LayerInfo, "source"> & { source: LayerInfo["source"] | LayerInfo["source"][number] }> };
  // Keep only categories the app knows; `source` may be one object or a list.
  return json.categories
    .filter((c) => PlaceCategory.safeParse(c.category).success)
    .map((c) => ({ ...c, source: Array.isArray(c.source) ? c.source : [c.source] }));
}

/** Places of one category. Invalid features are skipped (and logged) instead of breaking the map. */
export async function fetchLayer(category: PlaceCategory): Promise<Place[]> {
  const res = await fetch(`${LAYERS_URL}/${category}.geojson`);
  if (!res.ok) throw new Error(`layer ${category}: HTTP ${res.status}`);
  const fc = (await res.json()) as { features: LayerFeature[] };
  const places: Place[] = [];
  for (const f of fc.features) {
    const parsed = Place.safeParse({ ...f.properties, coords: f.geometry.coordinates });
    if (parsed.success) places.push(parsed.data);
    else console.warn(`[map] skipped invalid place in ${category}`, f.properties?.id);
  }
  return places;
}

/**
 * GeoJSON for the clustered map source. Only id and category travel with the features
 * (MapLibre stringifies nested properties); the popup reads the full Place by id.
 */
export function toFeatureCollection(places: Place[]) {
  return {
    type: "FeatureCollection" as const,
    features: places.map((p) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: p.coords },
      properties: { id: p.id, category: p.category },
    })),
  };
}
