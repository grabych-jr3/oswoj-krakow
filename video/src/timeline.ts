import scenes from "./scenes.json";
import voice from "./voice.json";
import { FPS } from "./theme";

export type Word = { text: string; start: number; end: number };
export type SceneTiming = {
  id: string;
  text: string;
  /** Frames from the scene start until the voice begins. */
  lead: number;
  /** Length of the scene in frames (voice + breathing room). */
  frames: number;
  words: Word[];
};

const LEAD = 8; // the picture moves a moment before the voice starts
const TAIL = 14; // a short pause after each sentence
export const TRANSITION = 12; // crossfade between scenes (frames)
const EXTRA: Record<string, number> = { "s8-end": 45 }; // hold the final card

const timings = voice as Record<string, { seconds: number; words: Word[] }>;

/** Every scene lasts exactly as long as its voice-over, so picture and voice stay in sync. */
export const TIMELINE: SceneTiming[] = scenes.map((s) => {
  const t = timings[s.id];
  if (!t) throw new Error(`No voice for ${s.id} – run npm run voice`);
  return {
    id: s.id,
    text: s.text,
    lead: LEAD,
    frames: LEAD + Math.ceil(t.seconds * FPS) + TAIL + TRANSITION + (EXTRA[s.id] ?? 0),
    words: t.words,
  };
});

export const TOTAL_FRAMES = TIMELINE.reduce((sum, s) => sum + s.frames, 0) - TRANSITION * (TIMELINE.length - 1);

/** Frame (within the scene) at which the first word matching `re` starts – to time animations to the voice. */
export function cue(scene: SceneTiming, re: RegExp, fallback = 0): number {
  const w = scene.words.find((x) => re.test(x.text.toLowerCase()));
  return w ? scene.lead + Math.round(w.start * FPS) : fallback;
}

export const scene = (id: string) => {
  const s = TIMELINE.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown scene ${id}`);
  return s;
};
