// Validates zone A data against the shared contracts (PLAN.md §5.5, `npm run validate:data`).
// Sample fixtures (A0) and the map layers in public/data/layers (A3, format: PLAN.md §5.3).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { z, type ZodType } from "zod";
import { LngLat, SourceRef } from "../src/contracts/common";
import { NearbyResult } from "../src/contracts/geo";
import { Place, PlaceCategory } from "../src/contracts/place";
import { DistrictArea, DistrictCollection } from "../src/server/geo/district-area";

const app = path.join(__dirname, "..");
const src = path.join(app, "src");
const layersDir = path.join(app, "public", "data", "layers");
// Kraków with a margin; every place must fall inside.
const KRAKOW_BBOX = { minLng: 19.78, maxLng: 20.23, minLat: 49.96, maxLat: 50.13 };

const LayerIndex = z.object({
  generatedAt: z.string().refine((s) => !Number.isNaN(Date.parse(s)), "not an ISO date"),
  categories: z.array(
    z.object({
      category: PlaceCategory,
      count: z.number().int().nonnegative(),
      updatedAt: z.string().nullable(),
      source: z.array(SourceRef).min(1),
    }),
  ),
});

const PlaceFeature = z.object({
  type: z.literal("Feature"),
  geometry: z.object({ type: z.literal("Point"), coordinates: LngLat }),
  properties: Place.omit({ coords: true }),
});
const PlaceLayer = z.object({ type: z.literal("FeatureCollection"), features: z.array(PlaceFeature) });

const errors: string[] = [];
const read = (file: string) => JSON.parse(readFileSync(file, "utf8"));

function check(label: string, schema: ZodType, data: unknown): boolean {
  const result = schema.safeParse(data);
  if (!result.success) errors.push(`${label}\n${result.error.message}`);
  else console.log(`  ok ${label}`);
  return result.success;
}

// A0 fixtures
check("contracts/fixtures/places.sample.json", Place.array(), read(path.join(src, "contracts/fixtures/places.sample.json")));
check("contracts/fixtures/nearby.sample.json", NearbyResult, read(path.join(src, "contracts/fixtures/nearby.sample.json")));
check("server/geo/fixtures/district-13.sample.json", DistrictArea, read(path.join(src, "server/geo/fixtures/district-13.sample.json")));

// A3 layers
const indexFile = path.join(layersDir, "index.json");
if (existsSync(indexFile)) {
  const index = read(indexFile);
  if (check("public/data/layers/index.json", LayerIndex, index)) {
    const listed = new Set<string>();
    const ids = new Set<string>();
    for (const entry of (index as z.infer<typeof LayerIndex>).categories) {
      listed.add(entry.category);
      const label = `public/data/layers/${entry.category}.geojson`;
      const file = path.join(layersDir, `${entry.category}.geojson`);
      if (!existsSync(file)) {
        errors.push(`${label}: listed in index.json but missing`);
        continue;
      }
      const layer = read(file);
      if (!check(label, PlaceLayer, layer)) continue;
      const features = (layer as z.infer<typeof PlaceLayer>).features;
      if (features.length !== entry.count) errors.push(`${label}: ${features.length} features, index says ${entry.count}`);
      for (const { geometry, properties: p } of features) {
        const [lng, lat] = geometry.coordinates;
        if (p.category !== entry.category) errors.push(`${label}: ${p.id} has category ${p.category}`);
        if (!p.id.startsWith(`${entry.category}:`)) errors.push(`${label}: id ${p.id} lacks the category prefix`);
        if (ids.has(p.id)) errors.push(`${label}: duplicate id ${p.id}`);
        ids.add(p.id);
        const b = KRAKOW_BBOX;
        if (lng < b.minLng || lng > b.maxLng || lat < b.minLat || lat > b.maxLat) {
          errors.push(`${label}: ${p.id} at [${lng}, ${lat}] is outside Kraków`);
        }
      }
    }
    // every category layer on disk must be listed, or the map would never load it
    for (const file of readdirSync(layersDir)) {
      const name = file.replace(/\.geojson$/, "");
      if (file.endsWith(".geojson") && PlaceCategory.safeParse(name).success && !listed.has(name)) {
        errors.push(`public/data/layers/${file}: not listed in index.json`);
      }
    }
  }
}

// A4 districts: map layer and the server copy used by getDistrict must be the same valid file.
const districtsLayer = path.join(layersDir, "districts.geojson");
const districtsServer = path.join(app, "data", "geo", "districts.json");
if (existsSync(districtsLayer) || existsSync(districtsServer)) {
  if (!existsSync(districtsLayer) || !existsSync(districtsServer)) {
    errors.push("districts: public/data/layers/districts.geojson and data/geo/districts.json must both exist");
  } else if (readFileSync(districtsLayer, "utf8") !== readFileSync(districtsServer, "utf8")) {
    errors.push("districts: data/geo/districts.json differs from public/data/layers/districts.geojson");
  } else if (check("public/data/layers/districts.geojson", DistrictCollection, read(districtsLayer))) {
    const features = (read(districtsLayer) as DistrictCollection).features;
    const numbers = features.map((f) => f.properties.number).sort((a, b) => a - b);
    if (numbers.join() !== Array.from({ length: 18 }, (_, i) => i + 1).join()) {
      errors.push(`districts: numbers ${numbers.join()} are not 1..18`);
    }
    // placeCounts must add up to the places of each layer that carry a district
    if (existsSync(indexFile)) {
      for (const { category } of (read(indexFile) as z.infer<typeof LayerIndex>).categories) {
        const layer = read(path.join(layersDir, `${category}.geojson`)) as z.infer<typeof PlaceLayer>;
        const withDistrict = layer.features.filter((f) => f.properties.district).length;
        const counted = features.reduce((s, f) => s + (f.properties.placeCounts[category] ?? 0), 0);
        if (counted !== withDistrict) errors.push(`districts: placeCounts.${category} = ${counted}, layer has ${withDistrict}`);
      }
    }
  }
}

// A8 «15 minut»: places.json mirrors the layers; access.json indexes stay in range; access-index has every cell.
const placesFile = path.join(app, "data", "geo", "places.json");
const accessFile = path.join(app, "data", "geo", "access.json");
if (existsSync(placesFile) && existsSync(accessFile)) {
  const places = read(placesFile);
  if (check("data/geo/places.json", Place.array(), places)) {
    const layerIds = new Set<string>();
    if (existsSync(indexFile)) {
      for (const { category } of (read(indexFile) as z.infer<typeof LayerIndex>).categories) {
        for (const f of (read(path.join(layersDir, `${category}.geojson`)) as z.infer<typeof PlaceLayer>).features) {
          layerIds.add(f.properties.id);
        }
      }
    }
    const placeIds = new Set((places as Place[]).map((p) => p.id));
    if (placeIds.size !== layerIds.size || [...layerIds].some((id) => !placeIds.has(id))) {
      errors.push("data/geo/places.json differs from the layers: run `uv run geo-access` after rebuilding layers");
    }
    const access = read(accessFile) as {
      res: number; cells: string[]; modes: Record<string, { c: number[]; p: [number, number][] }[]>;
    };
    const n = access.cells.length;
    let bad = 0;
    for (const mode of ["walk", "transit"]) {
      const reach = access.modes?.[mode];
      if (!Array.isArray(reach) || reach.length !== n) {
        errors.push(`data/geo/access.json: modes.${mode} has ${reach?.length} entries, cells ${n}`);
        continue;
      }
      for (const r of reach) {
        bad += r.c.filter((i) => !Number.isInteger(i) || i < 0 || i >= n).length;
        bad += r.p.filter(([i, m]) => !Number.isInteger(i) || i < 0 || i >= placeIds.size || m < 0 || m > 15).length;
      }
    }
    if (bad) errors.push(`data/geo/access.json: ${bad} indexes or minutes out of range`);
    else console.log(`  ok data/geo/access.json (${n} cells)`);
    const indexPath = path.join(layersDir, "access-index.json");
    if (existsSync(indexPath)) {
      const idx = read(indexPath) as { res: number; cells: [string, number, number][] };
      if (idx.res !== access.res || idx.cells.length !== n || idx.cells.some((c, i) => c[0] !== access.cells[i])) {
        errors.push("public/data/layers/access-index.json does not match data/geo/access.json");
      } else console.log("  ok public/data/layers/access-index.json");
    }
  }
}

for (const e of errors) console.error(`  ✗ ${e}`);
process.exit(errors.length ? 1 : 0);
