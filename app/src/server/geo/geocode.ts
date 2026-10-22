// Real geocoder (A9): EMUiA address points from app/data/geo/addresses.json (`uv run geo-addresses`).
// Built for autocomplete: every query word may be the start of a street word ("wiel" → ul. Wielicka),
// Polish letters are optional, a house number may be partial ("2" → 2, 2a, 20…), one typo is forgiven.
import type { LngLat } from "@/contracts/common";
import type { GeocodeResult } from "@/contracts/geo";
import addressesJson from "../../../data/geo/addresses.json";

type AddressRow = [number: string, lng: number, lat: number, postal: number, district: number | null];
type Street = { name: string; key: string; kind: string | null; point: [number, number, number | null]; numbers: AddressRow[] };
export type AddressData = { districts: Record<string, string>; postal: string[]; streets: Street[] };

const DEFAULT_LIMIT = 5;
const KIND_WORDS = new Set(["ul", "ulica", "al", "aleja", "aleje", "os", "osiedle", "pl", "plac"]);
const CITY_WORDS = new Set(["krakow", "polska", "poland"]);
const KIND_OF: Record<string, string> = { al: "aleja", aleja: "aleja", aleje: "aleja", os: "osiedle", osiedle: "osiedle", pl: "plac", plac: "plac" };

/** Lowercase ASCII words, as `fold` in pipeline/geo/streets.py: "Generała Łokietka" → "generala lokietka". */
export function fold(text: string): string {
  return text
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** One typo at most: a letter added, missing, changed, or two neighbours swapped ("wielicak" → "wielicka"). */
export function withinOneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    const diff = [...a].flatMap((c, k) => (c === b[k] ? [] : [k]));
    if (diff.length === 2 && diff[1] === diff[0] + 1 && a[diff[0]] === b[diff[1]] && a[diff[1]] === b[diff[0]]) return true;
  }
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (a.length < b.length) j++;
    else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

type Query = { words: string[]; number: string | null; postal: string | null; kind: string | null };

/** "ul. Wielicka 28a, 30-552 Kraków" → words ["wielicka"], number "28a", postal "30-552", kind null. */
export function parseQuery(raw: string): Query {
  const postal = raw.match(/\b\d{2}-\d{3}\b/)?.[0] ?? null;
  const tokens = fold(raw.replace(/\b\d{2}-\d{3}\b/g, " ").replace(/(\d)\s*\/\s*\d+\w*/g, "$1")).split(" ").filter(Boolean);
  let kind: string | null = null;
  const words: string[] = [];
  for (const t of tokens) {
    if (KIND_WORDS.has(t) && words.length === 0) { kind = KIND_OF[t] ?? null; continue; }
    if (CITY_WORDS.has(t)) continue;
    words.push(t);
  }
  // the house number is the last numeric word after a street word ("al. 29 Listopada 5" → 5; "29 listopada" → none)
  let number: string | null = null;
  const last = words.at(-1);
  if (last && /^\d+[a-z]?$/.test(last) && words.some((w) => /[a-z]/.test(w) && !/^\d+[a-z]$/.test(w))) {
    number = words.pop()!;
  } else if (words.length >= 2 && /^\d+$/.test(words.at(-2)!) && /^[a-z]$/.test(last ?? "")) {
    number = words.at(-2)! + words.pop()!; // "28 a" → "28a"
    words.pop();
  }
  return { words, number, postal, kind };
}

export function createGeocoder(data: AddressData) {
  const streets = data.streets.map((s) => ({ ...s, tokens: s.key.split(" ") }));
  const districtOf = (n: number | null) => (n !== null && data.districts[n] ? { number: n, name: data.districts[n] } : null);

  /** How well the query words fit a street; null if some word fits no street word. */
  function score(words: string[], kind: string | null, street: (typeof streets)[number]): number | null {
    let total = 0;
    for (const w of words) {
      let best = 0;
      for (const t of street.tokens) {
        if (t === w) best = Math.max(best, 3);
        else if (t.startsWith(w)) best = Math.max(best, 2 * (w.length / t.length));
        else if (w.length >= 5 && withinOneEdit(w, t)) best = Math.max(best, 1);
      }
      if (best === 0) return null;
      total += best;
    }
    if (kind && street.kind === kind) total += 1;
    if (!kind && street.kind && street.tokens[0] === street.kind) total -= 0.5; // "Zgody" before "Osiedle Zgody"
    // the more of the street name the query covers, the better ("wielicka" fits Wielicka better than Wielickiego);
    // on a tie, a longer street (more addresses) is the likelier one ("wiel" → Wielicka before Wielkie Pola)
    return total + words.join("").length / street.key.replace(/ /g, "").length + 0.15 * Math.log10(street.numbers.length + 1);
  }

  // reverse lookup: address points bucketed on a ~150 × 220 m grid
  const BUCKET = 500; // 1/500° per bucket
  const buckets = new Map<string, Array<[Street, AddressRow]>>();
  const bucketKey = (lng: number, lat: number) => `${Math.floor(lng * BUCKET)}:${Math.floor(lat * BUCKET)}`;
  for (const s of streets) {
    for (const row of s.numbers) {
      const key = bucketKey(row[1], row[2]);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push([s, row]);
    }
  }

  function label(street: Street, number: string | null, postal: number) {
    const code = postal >= 0 ? data.postal[postal] : null;
    return `${street.name}${number ? ` ${number}` : ""}, ${code ? `${code} ` : ""}Kraków`;
  }

  return {
    /** The address of the nearest EMUiA point within `maxM` metres ("ul. Wielicka 28, 30-552 Kraków"), or null. */
    reverse([lng, lat]: LngLat, maxM = 60): string | null {
      const bx = Math.floor(lng * BUCKET);
      const by = Math.floor(lat * BUCKET);
      let best: { d: number; label: string } | null = null;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (const [s, [n, x, y, postal]] of buckets.get(`${bx + dx}:${by + dy}`) ?? []) {
            const d = Math.hypot((x - lng) * 71_500, (y - lat) * 111_300); // metres at Kraków's latitude
            if (d <= maxM && (!best || d < best.d)) best = { d, label: label(s, n, postal) };
          }
        }
      }
      return best?.label ?? null;
    },

    geocode(query: string, limit = DEFAULT_LIMIT): GeocodeResult[] {
      const q = parseQuery(query);
      if (q.words.length === 0 || limit <= 0) return [];
      const ranked = streets
        .map((s) => ({ s, score: score(q.words, q.kind, s) }))
        .filter((r): r is { s: (typeof streets)[number]; score: number } => r.score !== null)
        .sort((a, b) => b.score - a.score || a.s.name.length - b.s.name.length || a.s.name.localeCompare(b.s.name, "pl"));
      const results: GeocodeResult[] = [];
      if (q.number) {
        const wanted = q.number;
        for (const { s } of ranked.slice(0, 10)) {
          const rows = s.numbers
            .filter(([n]) => n.toLowerCase().startsWith(wanted))
            .sort((a, b) => Number(b[0].toLowerCase() === wanted) - Number(a[0].toLowerCase() === wanted)
              || Number(q.postal !== null && data.postal[b[3]] === q.postal) - Number(q.postal !== null && data.postal[a[3]] === q.postal));
          for (const [n, lng, lat, postal, district] of rows) {
            results.push({ label: label(s, n, postal), coords: [lng, lat] as LngLat, district: districtOf(district), precision: "address" });
            if (results.length >= limit) return results;
          }
        }
        if (results.length) return results;
      }
      // no number (or none on these streets): the streets themselves
      for (const { s } of ranked.slice(0, limit)) {
        const [lng, lat, district] = s.point;
        results.push({ label: `${s.name}, Kraków`, coords: [lng, lat], district: districtOf(district), precision: "street" });
      }
      return results;
    },
  };
}

export const geocoder = createGeocoder(addressesJson as unknown as AddressData);
