// Polish voice-over with ElevenLabs, read as ONE take (natural pauses and intonation between scenes),
// then cut into scenes in the middle of each pause, with short fades so no sentence ends abruptly.
// Writes public/voice/<id>.mp3 and src/voice.json (scene length + word timings for the subtitles).
// The take is cached in voice-cache.json by its text: re-cutting costs no ElevenLabs characters.
// Needs ELEVENLABS_API_KEY in video/.env. Usage: npm run voice
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"; // George – warm, deep storyteller (chosen by the team)
const MODEL = "eleven_multilingual_v2";
const RATE = 44100;
const FADE_IN = 0.05; // seconds
const FADE_OUT = 0.18;
const TAIL_MAX = 0.5; // silence kept after the last word of a scene

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1").replace(/\/$/, "");
const env = readFileSync(`${root}/.env`, "utf8");
const scenes = JSON.parse(readFileSync(`${root}/src/scenes.json`, "utf8"));
const ff = (args) => execSync(`npx remotion ffmpeg -y -loglevel error ${args}`, { cwd: root, stdio: "inherit" });

// Paragraph breaks give the voice a natural pause between scenes.
const text = scenes.map((s) => s.text).join("\n\n");
const cacheFile = `${root}/voice-cache.json`;
const cache = existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, "utf8")) : null;
let data = cache?.text === text ? cache.data : null;
if (!data) {
  const key = env.match(/ELEVENLABS_API_KEY=(\S+)/)?.[1];
  if (!key) throw new Error("ELEVENLABS_API_KEY missing in video/.env");
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/with-timestamps?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key, "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      text,
      model_id: MODEL,
      language_code: "pl",
      voice_settings: { stability: 0.55, similarity_boost: 0.8, style: 0.1, use_speaker_boost: true },
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  data = await res.json();
  writeFileSync(cacheFile, JSON.stringify({ text, data }));
  console.log("new take from ElevenLabs");
}

const tmp = `${root}/out/voice-full`;
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
writeFileSync(`${tmp}/full.mp3`, Buffer.from(data.audio_base64, "base64"));
ff(`-i "${tmp}/full.mp3" -ac 1 -ar ${RATE} -c:a pcm_s16le "${tmp}/full.wav"`);
const pcm = readFileSync(`${tmp}/full.wav`).subarray(44);
const total = pcm.length / 2 / RATE;

/** Samples [start, end) seconds with fades at both ends, written as MP3 (Remotion's ffmpeg has no audio filters). */
function cut(start, end, out) {
  const a = Math.round(start * RATE);
  const n = Math.min(Math.round(end * RATE), pcm.length / 2) - a;
  const fin = Math.round(FADE_IN * RATE);
  const fout = Math.round(FADE_OUT * RATE);
  const body = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    const g = Math.max(0, Math.min(1, i / fin, (n - 1 - i) / fout));
    body.writeInt16LE(Math.round(pcm.readInt16LE((a + i) * 2) * g * g), i * 2);
  }
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + body.length, 4);
  h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(body.length, 40);
  writeFileSync(`${tmp}/cut.wav`, Buffer.concat([h, body]));
  ff(`-i "${tmp}/cut.wav" -b:a 160k "${out}"`);
  return n / RATE;
}

// Characters with times → words with times.
const al = data.alignment;
const words = [];
let cur = null;
al.characters.forEach((ch, i) => {
  if (/\s/.test(ch)) {
    if (cur) words.push(cur);
    cur = null;
    return;
  }
  if (!cur) cur = { text: "", start: al.character_start_times_seconds[i], end: 0 };
  cur.text += ch;
  cur.end = al.character_end_times_seconds[i];
});
if (cur) words.push(cur);

// Words belong to scenes in order; each scene's text has a known number of words.
let w = 0;
const spans = scenes.map((s) => {
  const n = s.text.split(/\s+/).filter(Boolean).length;
  const ws = words.slice(w, w + n);
  w += n;
  return { id: s.id, words: ws };
});
if (w !== words.length) throw new Error(`word count mismatch: ${w} vs ${words.length}`);

const timings = {};
spans.forEach((sp, i) => {
  const first = sp.words[0];
  const last = sp.words.at(-1);
  const next = spans[i + 1]?.words[0];
  const prev = spans[i - 1]?.words.at(-1);
  // Cut inside the pauses: a little air before the first word, a natural decay after the last one.
  const start = prev ? Math.max(prev.end + TAIL_MAX, (prev.end + first.start) / 2, first.start - 0.25) : Math.max(0, first.start - 0.08);
  const end = next ? Math.min(last.end + TAIL_MAX, (last.end + next.start) / 2) : Math.min(total, last.end + 0.9);
  const offset = Math.max(0, Math.min(start, first.start - 0.02));
  const seconds = cut(offset, end, `${root}/public/voice/${sp.id}.mp3`);
  timings[sp.id] = {
    seconds: +seconds.toFixed(3),
    words: sp.words.map((x) => ({ text: x.text, start: +(x.start - offset).toFixed(3), end: +(x.end - offset).toFixed(3) })),
  };
  console.log(`${sp.id}: ${seconds.toFixed(2)} s, air after the last word ${(end - last.end).toFixed(2)} s`);
});
writeFileSync(`${root}/src/voice.json`, JSON.stringify(timings, null, 2) + "\n");
rmSync(tmp, { recursive: true, force: true });
