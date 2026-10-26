// Raw material for the animated app mock-ups: clean map images from the real app (no UI on top),
// pixel positions of markers / zones on them, and texts from the real data. Writes public/mock/*.png
// and src/mock.json. Needs the app running with the map test hook:
// in app/, `NEXT_PUBLIC_EXPOSE_MAP=1 npm run build && npm start`. Usage: APP_URL=… npm run capture
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import puppeteer from "puppeteer-core";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1").replace(/\/$/, "");
const APP = `${root}/../app`;
const BASE = process.env.APP_URL ?? "http://localhost:3000";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
mkdirSync(`${root}/public/mock`, { recursive: true });

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--hide-scrollbars"] });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** A page showing only the map canvas, with the app's own layers hidden. */
async function mapOnly(viewport) {
  const page = await browser.newPage();
  await page.setViewport({ ...viewport, deviceScaleFactor: 2 });
  await page.setCookie({ name: "ok-welcome-seen", value: "1", url: BASE });
  await page.goto(`${BASE}/pl/mapa`, { waitUntil: "networkidle2" });
  await page.waitForFunction(() => window.__map && window.__map.getLayer("places-points"), { timeout: 60000 });
  await page.addStyleTag({ content: "aside, section > div:not(:first-child), [class*='absolute'] { display: none !important } .maplibregl-map { position: fixed !important; inset: 0 !important }" });
  await page.evaluate(() => {
    const m = window.__map;
    m.resize();
    m.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
    for (const l of m.getStyle().layers) if (/^(places|chat|districts|access)/.test(l.id)) m.setLayoutProperty(l.id, "visibility", "none");
  });
  return page;
}
const settle = async (page) => {
  await wait(500);
  await page.waitForFunction(() => !window.__map.isMoving() && window.__map.loaded() && window.__map.areTilesLoaded(), { timeout: 60000 });
  await wait(800);
};
const project = (page, coords) => page.evaluate((cs) => cs.map((c) => { const p = window.__map.project(c); return [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10]; }), coords);

const mock = {};

// 1. Assistant: SA-34 card from the knowledge base, its offices on a map of Kraków.
{
  const procs = JSON.parse(readFileSync(`${APP}/data/kb/procedures.json`, "utf8"));
  const sa34 = procs.find((p) => p.symbol === "SA-34");
  const urzad = JSON.parse(readFileSync(`${APP}/public/data/layers/urzad.geojson`, "utf8")).features;
  const offices = sa34.offices.map((o) => ({ id: o.id, name: o.name, address: o.address.split(",").slice(0, 1).join(""), hours: o.hours, coords: urzad.find((f) => f.properties.id === o.id)?.geometry.coordinates }));
  const docs = sa34.sections.dokumenty
    .split("\n")
    .map((l) => l.replace(/^\s*\d+\.\s*/, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim())
    .filter((l) => l && !l.startsWith("|"))
    .slice(0, 2);
  const W = 1320, H = 825;
  const page = await mapOnly({ width: W, height: H });
  const pts = offices.filter((o) => o.coords).map((o) => o.coords);
  await page.evaluate((pts) => {
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    window.__map.fitBounds([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], { padding: { top: 140, bottom: 120, left: 120, right: 520 }, duration: 0, maxZoom: 14 });
  }, pts);
  await settle(page);
  await page.screenshot({ path: `${root}/public/mock/map-assistant.png` });
  const px = await project(page, pts);
  let k = 0;
  mock.assistant = {
    size: [W, H],
    symbol: sa34.symbol,
    title: sa34.title,
    termin: sa34.sections.termin,
    fee: "17 zł – tylko za pełnomocnictwo",
    docs,
    offices: offices.map((o, i) => ({ label: String(i + 1), name: o.name.replace(/\s*\(.*$/, ""), address: o.address, hours: o.hours, px: o.coords ? px[k++] : null })),
  };
  await page.close();
}

// 2. "Kraków w 15 minut" on a phone: map around ul. Wielicka 28, walking and transit zones, places.
{
  const W = 390, H = 844;
  const origin = [19.96563, 50.04022];
  const get = async (mode) => (await fetch(`${BASE}/api/nearby?lng=${origin[0]}&lat=${origin[1]}&mode=${mode}`)).json();
  const [walk, transit] = await Promise.all([get("walk"), get("transit")]);
  const page = await mapOnly({ width: W, height: H });
  await page.evaluate((o) => window.__map.jumpTo({ center: [o[0] + 0.0012, o[1] - 0.006], zoom: 13.6 }), origin);
  await settle(page);
  await page.screenshot({ path: `${root}/public/mock/map-phone.png` });
  const rings = (area) => (area.geometry.type === "Polygon" ? [area.geometry.coordinates[0]] : area.geometry.coordinates.map((p) => p[0]));
  const toPath = async (area) => {
    const out = [];
    for (const ring of rings(area)) out.push((await project(page, ring)).map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ") + " Z");
    return out.join(" ");
  };
  const places = async (r) => {
    const ps = r.places.slice(0, 28);
    const px = await project(page, ps.map((p) => p.coords));
    return ps.map((p, i) => ({ category: p.category, px: px[i] }));
  };
  mock.fifteen = {
    size: [W, H],
    label: walk.origin.label,
    origin: (await project(page, [origin]))[0],
    walk: { path: await toPath(walk.area), places: await places(walk), score: Math.round(walk.score.value), missing: walk.score.missing },
    transit: { path: await toPath(transit.area), places: await places(transit), score: Math.round(transit.score.value), missing: transit.score.missing },
  };
  await page.close();
}

// 3. City-wide "Indeks 15 minut": the whole of Kraków, large enough for a slow zoom.
{
  const page = await mapOnly({ width: 1600, height: 1000 });
  await page.evaluate(() => {
    const m = window.__map;
    for (const l of m.getStyle().layers) if (/^(access|districts)/.test(l.id)) m.setLayoutProperty(l.id, "visibility", "visible");
  });
  // the overlay layers exist only once switched on in the app
  const hasIndex = await page.evaluate(() => !!window.__map.getLayer("access-index-fill"));
  if (!hasIndex) {
    await page.addStyleTag({ content: "section > div:not(:first-child) { display: block !important }" });
    await page.evaluate(() => document.querySelector("label[for='layers-desktop-overlay-index']")?.click());
    await page.waitForFunction(() => window.__map.getLayer("access-index-fill"), { timeout: 30000 });
    await page.addStyleTag({ content: "section > div:not(:first-child) { display: none !important }" });
  }
  await page.evaluate(() => {
    const m = window.__map;
    for (const l of m.getStyle().layers) if (/^(places|chat)/.test(l.id)) m.setLayoutProperty(l.id, "visibility", "none");
    m.jumpTo({ center: [19.965, 50.055], zoom: 10.9 });
  });
  await settle(page);
  await page.screenshot({ path: `${root}/public/mock/map-city.png` });
  mock.city = { size: [1600, 1000] };
  await page.close();
}

writeFileSync(`${root}/src/mock.json`, JSON.stringify(mock, null, 2) + "\n");
console.log(JSON.stringify({ offices: mock.assistant.offices.map((o) => o.px), walk: mock.fifteen.walk.places.length, transit: mock.fifteen.transit.places.length, scores: [mock.fifteen.walk.score, mock.fifteen.transit.score] }));
await browser.close();
