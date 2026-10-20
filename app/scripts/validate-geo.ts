// Validates zone A data against the shared contracts (PLAN.md §5.5, `npm run validate:data`).
// Sample fixtures (A0) and the map layers in public/data/layers (A3, format: PLAN.md §5.3).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { z, type ZodType } from "zod";
import { LngLat, SourceRef } from "../src/contracts/common";
import { NearbyResult } from "../src/contracts/geo";
import { Place, PlaceCategory } from "../src/contracts/place";
import { DistrictArea } from "../src/server/geo/district-area";

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

for (const e of errors) console.error(`  ✗ ${e}`);
process.exit(errors.length ? 1 : 0);
