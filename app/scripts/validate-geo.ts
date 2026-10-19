// Validates zone A data against the shared contracts (PLAN.md §5.5, `npm run validate:data`).
// For now: the sample fixtures. Real layers (app/public/data/layers, app/data/geo) are added in A3+.
import { readFileSync } from "node:fs";
import path from "node:path";
import type { ZodType } from "zod";
import { NearbyResult } from "../src/contracts/geo";
import { Place } from "../src/contracts/place";

const fixtures = path.join(__dirname, "..", "src", "contracts", "fixtures");
const checks: Array<[string, ZodType]> = [
  ["places.sample.json", Place.array()],
  ["nearby.sample.json", NearbyResult],
];

let failed = false;
for (const [file, schema] of checks) {
  const result = schema.safeParse(JSON.parse(readFileSync(path.join(fixtures, file), "utf8")));
  if (result.success) {
    console.log(`  ok ${file}`);
  } else {
    failed = true;
    console.error(`  ✗ ${file}\n${result.error.message}`);
  }
}

process.exit(failed ? 1 : 0);
