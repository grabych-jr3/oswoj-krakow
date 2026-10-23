// Polish voice-over with ElevenLabs: one MP3 per scene + word timings for the subtitles.
// Writes public/voice/<id>.mp3 and src/voice.json. Needs ELEVENLABS_API_KEY in video/.env.
// Usage: npm run voice            (all scenes)
//        npm run voice -- s3-reveal (only the given scenes, e.g. after a text change)
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"; // George – warm, deep storyteller (chosen by the team)
const MODEL = "eleven_multilingual_v2";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const key = readFileSync(`${root}/.env`, "utf8").match(/ELEVENLABS_API_KEY=(\S+)/)?.[1];
if (!key) throw new Error("ELEVENLABS_API_KEY missing in video/.env");

const scenes = JSON.parse(readFileSync(`${root}/src/scenes.json`, "utf8"));
const only = process.argv.slice(2);
const outFile = `${root}/src/voice.json`;
const timings = existsSync(outFile) ? JSON.parse(readFileSync(outFile, "utf8")) : {};

/** Characters with times → words with times (for subtitles). */
function words(alignment) {
  const out = [];
  let cur = null;
  alignment.characters.forEach((ch, i) => {
    if (/\s/.test(ch)) {
      if (cur) out.push(cur);
      cur = null;
      return;
    }
    if (!cur) cur = { text: "", start: alignment.character_start_times_seconds[i], end: 0 };
    cur.text += ch;
    cur.end = alignment.character_end_times_seconds[i];
  });
  if (cur) out.push(cur);
  return out;
}

/** Exact length of the MP3 (ffprobe bundled with Remotion). */
function duration(file) {
  const out = execSync(`npx remotion ffprobe -v error -show_entries format=duration -of csv=p=0 "${file}"`, { cwd: root, encoding: "utf8" });
  return Number(out.trim().split(/\s+/).pop());
}

for (const [i, scene] of scenes.entries()) {
  if (only.length && !only.includes(scene.id)) continue;
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/with-timestamps?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key, "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      text: scene.text,
      model_id: MODEL,
      language_code: "pl",
      // Neighbouring sentences keep the intonation continuous across scenes.
      previous_text: scenes[i - 1]?.text,
      next_text: scenes[i + 1]?.text,
      voice_settings: { stability: 0.55, similarity_boost: 0.8, style: 0.1, use_speaker_boost: true },
    }),
  });
  if (!res.ok) throw new Error(`${scene.id}: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const mp3 = `${root}/public/voice/${scene.id}.mp3`;
  writeFileSync(mp3, Buffer.from(data.audio_base64, "base64"));
  timings[scene.id] = { seconds: duration(mp3), words: words(data.alignment) };
  console.log(`${scene.id}: ${timings[scene.id].seconds.toFixed(2)} s, ${timings[scene.id].words.length} words`);
}

writeFileSync(outFile, JSON.stringify(timings, null, 2) + "\n");
const sub = await (await fetch("https://api.elevenlabs.io/v1/user/subscription", { headers: { "xi-api-key": key } })).json();
console.log(`ElevenLabs characters used this month: ${sub.character_count} / ${sub.character_limit}`);
