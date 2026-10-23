// Background music, synthesised from scratch (so there is no licence question): soft pads on a slow
// I–vi–IV–V progression in C with a quiet arpeggio. Writes public/music/bed.mp3 (WAV → MP3 via Remotion's ffmpeg).
// Usage: npm run music [-- <seconds>]
import { execSync } from "node:child_process";
import { unlinkSync, writeFileSync } from "node:fs";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const SECONDS = Number(process.argv[2] ?? 90);
const RATE = 44100;
const BAR = 4; // seconds per chord

// MIDI notes: Cmaj9, Am9, Fmaj9, G6/9 – open voicings, low register for the pad.
const CHORDS = [
  [48, 55, 59, 62, 64],
  [45, 52, 55, 59, 60],
  [41, 48, 52, 55, 57],
  [43, 50, 52, 55, 57],
];
const hz = (m) => 440 * 2 ** ((m - 69) / 12);

const n = Math.round(SECONDS * RATE);
const left = new Float32Array(n);
const right = new Float32Array(n);

// Pads: detuned sines with slow swells, one chord per bar, crossfaded.
for (let i = 0; i < n; i++) {
  const t = i / RATE;
  const bar = Math.floor(t / BAR);
  const inBar = t - bar * BAR;
  for (const [k, offset] of [[bar, 0], [bar - 1, BAR]]) {
    if (k < 0) continue;
    const local = inBar + offset; // time since this chord started
    const env = Math.min(1, local / 1.6) * (local < BAR ? 1 : Math.max(0, 1 - (local - BAR) / 1.6));
    if (env <= 0) continue;
    for (const [j, m] of CHORDS[k % 4].entries()) {
      const f = hz(m);
      const v = env * 0.05 * (j === 0 ? 1.3 : 1);
      left[i] += v * (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(2 * Math.PI * f * 1.003 * t + 1));
      right[i] += v * (Math.sin(2 * Math.PI * f * 0.998 * t + 0.5) + 0.3 * Math.sin(2 * Math.PI * f * 2 * t) * 0.3);
    }
  }
}

// Arpeggio: soft plucks, eighth notes at 90 bpm, two octaves up, gentle decay.
const STEP = 60 / 90 / 2;
for (let s = 0; s * STEP < SECONDS; s++) {
  const t0 = s * STEP;
  const chord = CHORDS[Math.floor(t0 / BAR) % 4];
  const note = chord[[1, 2, 3, 4, 3, 2][s % 6]] + 24;
  const f = hz(note);
  const pan = 0.5 + 0.3 * Math.sin(s * 0.7);
  const start = Math.round(t0 * RATE);
  for (let i = 0; i < RATE * 1.2 && start + i < n; i++) {
    const t = i / RATE;
    const v = 0.035 * Math.exp(-t * 4.5) * Math.min(1, t / 0.005) * (Math.sin(2 * Math.PI * f * t) + 0.15 * Math.sin(4 * Math.PI * f * t));
    left[start + i] += v * (1 - pan);
    right[start + i] += v * pan;
  }
}

// Fade in / out, normalise to a quiet level.
const fade = RATE * 2.5;
let peak = 0;
for (let i = 0; i < n; i++) {
  const g = Math.min(1, i / fade, (n - i) / (RATE * 4));
  left[i] *= g;
  right[i] *= g;
  peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
}
const gain = 0.5 / peak;

const data = Buffer.alloc(n * 4);
for (let i = 0; i < n; i++) {
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left[i] * gain)) * 32767), i * 4);
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right[i] * gain)) * 32767), i * 4 + 2);
}
const header = Buffer.alloc(44);
header.write("RIFF", 0);
header.writeUInt32LE(36 + data.length, 4);
header.write("WAVEfmt ", 8);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(2, 22);
header.writeUInt32LE(RATE, 24);
header.writeUInt32LE(RATE * 4, 28);
header.writeUInt16LE(4, 32);
header.writeUInt16LE(16, 34);
header.write("data", 36);
header.writeUInt32LE(data.length, 40);

const wav = `${root}/public/music/bed.wav`;
writeFileSync(wav, Buffer.concat([header, data]));
execSync(`npx remotion ffmpeg -y -loglevel error -i "${wav}" -b:a 160k "${root}/public/music/bed.mp3"`, { cwd: root, stdio: "inherit" });
unlinkSync(wav);
console.log(`music: ${SECONDS} s → public/music/bed.mp3`);
