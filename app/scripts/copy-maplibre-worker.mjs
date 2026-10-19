// MapLibre resolves its web worker with a dynamic `new URL(…, import.meta.url)`, which the
// Next.js bundler cannot follow, so the map stays blank ("Worker failed to load").
// We serve the worker from /public instead and point MapLibre at it (see BaseMap.tsx).
// Runs before `dev` and `build`, so the file always matches the installed maplibre-gl version.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const pkgDir = path.dirname(require.resolve("maplibre-gl/package.json"));
const src = path.join(pkgDir, "dist", "maplibre-gl-worker.mjs");
const dest = path.join(import.meta.dirname, "..", "public", "maplibre-gl-worker.mjs");

mkdirSync(path.dirname(dest), { recursive: true });
copyFileSync(src, dest);
console.log(`copied maplibre worker → public/${path.basename(dest)}`);
