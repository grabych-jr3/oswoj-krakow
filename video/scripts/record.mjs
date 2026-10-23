// Screen recordings of the real app for the video: drives Chrome, takes timed screenshots and turns them
// into steady 30 fps MP4s with Remotion's ffmpeg.
// Needs the app running with the map test hook: in app/, `NEXT_PUBLIC_EXPOSE_MAP=1 npm run build && npm start`
// (keys in app/.env.local for real answers). Usage: npm run record [-- assistant fifteen city]
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import puppeteer from "puppeteer-core";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1").replace(/\/$/, "");
const BASE = process.env.APP_URL ?? "http://localhost:3000";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const FPS = 30;
const only = process.argv.slice(2);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--hide-scrollbars"],
});

async function openPage(viewport) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  await page.setCookie({ name: "ok-welcome-seen", value: "1", url: BASE });
  return page;
}
const mapReady = (page) =>
  page.waitForFunction(() => window.__map && window.__map.getLayer("places-points") && window.__map.areTilesLoaded(), { timeout: 60000 });
const mapSettled = async (page) => {
  await wait(300);
  await page.waitForFunction(() => !window.__map.isMoving() && window.__map.areTilesLoaded(), { timeout: 30000 }).catch(() => {});
};
const hideCategories = (page) =>
  page.evaluate(() => [...document.querySelectorAll("#layers-desktop-panel button")].find((b) => /Ukryj wszystkie/.test(b.textContent)).click());

/**
 * Frame recorder. Software-rendered Chrome cannot screencast smoothly, so the script sets the time:
 * `hold(page, s)` adds one screenshot shown for s seconds (one frame = 1/30 s), and `live(page, until)`
 * screenshots in real time while something happens on its own (an answer streaming in).
 */
function recorder(name) {
  const dir = `${root}/out/frames-${name}`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const frames = [];
  const shot = async (page) => {
    const file = `${dir}/${String(frames.length).padStart(5, "0")}.jpg`;
    await page.screenshot({ path: file, type: "jpeg", quality: 92 });
    return file;
  };
  return {
    async hold(page, seconds = 1 / FPS) {
      frames.push({ file: await shot(page), seconds });
    },
    async live(page, until, maxSeconds = 60) {
      const start = Date.now();
      while (Date.now() - start < maxSeconds * 1000) {
        const t = Date.now();
        const file = await shot(page);
        const done = await until().catch(() => false);
        frames.push({ file, seconds: Math.max(1 / FPS, (Date.now() - t) / 1000) });
        if (done) break;
      }
    },
    finish() {
      const lines = frames.flatMap((f) => [`file '${f.file}'`, `duration ${f.seconds.toFixed(4)}`]);
      lines.push(`file '${frames.at(-1).file}'`);
      writeFileSync(`${dir}/list.txt`, lines.join("\n"));
      const out = `${root}/public/rec/${name}.mp4`;
      execSync(
        `npx remotion ffmpeg -y -loglevel error -f concat -safe 0 -i "${dir}/list.txt" -fps_mode cfr -r ${FPS} -c:v libx264 -pix_fmt yuv420p -crf 18 "${out}"`,
        { cwd: root, stdio: "inherit" },
      );
      rmSync(dir, { recursive: true, force: true });
      const total = frames.reduce((x, f) => x + f.seconds, 0);
      // The video fits each clip to its scene, so it needs the clip lengths.
      const clipsFile = `${root}/src/clips.json`;
      const clips = existsSync(clipsFile) ? JSON.parse(readFileSync(clipsFile, "utf8")) : {};
      clips[name] = Number(total.toFixed(2));
      writeFileSync(clipsFile, JSON.stringify(clips, null, 2) + "
");
      console.log(`${name}: ${frames.length} shots, ${total.toFixed(1)} s → public/rec/${name}.mp4`);
    },
  };
}

/** Types text letter by letter, a screenshot after each one. */
async function typeFramed(rec, page, selector, text, framesPerChar = 2) {
  await page.click(selector);
  await rec.hold(page, 0.3);
  for (const ch of text) {
    await page.keyboard.type(ch);
    await rec.hold(page, framesPerChar / FPS);
  }
}

/** Moves the map camera frame by frame (each frame fully drawn) from the current view to `to`. */
async function cameraFramed(rec, page, to, seconds) {
  const from = await page.evaluate(() => ({ center: window.__map.getCenter().toArray(), zoom: window.__map.getZoom() }));
  const n = Math.round(seconds * FPS);
  for (let i = 1; i <= n; i++) {
    const k = i / n;
    const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2; // ease in-out
    const center = [from.center[0] + (to.center[0] - from.center[0]) * e, from.center[1] + (to.center[1] - from.center[1]) * e];
    await page.evaluate(([c, z]) => window.__map.jumpTo({ center: c, zoom: z }), [center, from.zoom + (to.zoom - from.zoom) * e]);
    await page.waitForFunction(() => window.__map.loaded() && window.__map.areTilesLoaded(), { timeout: 20000 }).catch(() => {});
    await rec.hold(page);
  }
}

/** Smooth scroll of the chat list to the first card, frame by frame. */
async function scrollToCard(rec, page, seconds) {
  const [from, to] = await page.$eval("#chat-messages", (el) => [el.scrollTop, el.querySelector("article").offsetTop - 12]);
  const n = Math.round(seconds * FPS);
  for (let i = 1; i <= n; i++) {
    const e = 1 - (1 - i / n) ** 3;
    await page.$eval("#chat-messages", (el, v) => (el.scrollTop = v), from + (to - from) * e);
    await rec.hold(page);
  }
}

const idle = (page) => page.evaluate(() => !window.__map.isMoving() && window.__map.areTilesLoaded());

// 1. Assistant on a laptop: question about PESEL → answer with the BIP card, offices on the map.
if (!only.length || only.includes("assistant")) {
  const page = await openPage({ width: 1440, height: 900, deviceScaleFactor: 1.5 });
  await page.goto(`${BASE}/pl/mapa`, { waitUntil: "networkidle2" });
  await mapReady(page);
  // A calm map: categories off, layer panel folded; the answer's numbered offices then stand out.
  await hideCategories(page);
  await page.click("#layers-desktop-panel button[aria-label='Zwiń warstwy']");
  await mapSettled(page);
  const rec = recorder("assistant");
  await rec.hold(page, 0.6);
  await typeFramed(rec, page, "#chat-input", "Gdzie mogę uzyskać PESEL i co muszę zabrać?");
  await rec.hold(page, 0.4);
  await page.keyboard.press("Enter");
  await rec.live(page, () => page.evaluate(() => !!document.querySelector("#chat-messages[aria-busy='false'] article h3")));
  await rec.live(page, () => idle(page), 8);
  await rec.hold(page, 1.2);
  await scrollToCard(rec, page, 1.3);
  await rec.hold(page, 3);
  rec.finish();
  await page.close();
}

// 2. "Kraków w 15 minut" on a phone: address → zone → by public transport.
if (!only.length || only.includes("fifteen")) {
  const page = await openPage({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(`${BASE}/pl/mapa`, { waitUntil: "networkidle2" });
  await mapReady(page);
  await mapSettled(page);
  const rec = recorder("fifteen");
  await rec.hold(page, 0.6);
  await typeFramed(rec, page, "#address-search", "Wielicka 28", 3);
  await page.waitForFunction(() => document.querySelectorAll("[role=option]").length > 0, { timeout: 15000 });
  await rec.hold(page, 0.9);
  await page.tap("[role=option]");
  await rec.live(page, () => page.evaluate(() => !!document.querySelector("#nearby-panel[aria-busy='false'] [role=img]")));
  await rec.live(page, () => idle(page), 8);
  await rec.hold(page, 2.2);
  await page.evaluate(() => [...document.querySelectorAll("#nearby-panel [role=radio]")].find((b) => /Komunikacj/.test(b.textContent)).click());
  await rec.live(page, () => page.evaluate(() => !!document.querySelector("#nearby-panel[aria-busy='false'] [role=img]")));
  await rec.live(page, () => idle(page), 8);
  await rec.hold(page, 3);
  rec.finish();
  await page.close();
}

// 3. City-wide "Indeks 15 minut": a slow, smooth move over the whole city.
if (!only.length || only.includes("city")) {
  const page = await openPage({ width: 1440, height: 900, deviceScaleFactor: 1.5 });
  await page.goto(`${BASE}/pl/mapa`, { waitUntil: "networkidle2" });
  await mapReady(page);
  await hideCategories(page);
  await page.click("label[for='layers-desktop-overlay-index']");
  await page.waitForFunction(() => window.__map.getLayer("access-index-fill"), { timeout: 30000 });
  await page.evaluate(() => window.__map.jumpTo({ center: [19.95, 50.06], zoom: 10.6 }));
  await mapSettled(page);
  await wait(1500);
  const rec = recorder("city");
  await rec.hold(page, 0.5);
  await cameraFramed(rec, page, { center: [19.97, 50.05], zoom: 11.4 }, 9);
  await rec.hold(page, 0.5);
  rec.finish();
  await page.close();
}

await browser.close();
