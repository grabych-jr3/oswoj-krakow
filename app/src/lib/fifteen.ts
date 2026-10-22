import type { PlaceCategory } from "@/contracts/place";

/**
 * The six basic groups behind "Indeks 15 minut" (PLAN.md §4.2, item 4):
 * index = 100 × (groups present within 15 minutes) / 6.
 */
export const INDEX_GROUPS = [
  { id: "care", categories: ["zlobek", "klub_dzieciecy"] },
  { id: "przedszkole", categories: ["przedszkole"] },
  { id: "school", categories: ["szkola_podstawowa"] },
  { id: "green", categories: ["park", "park_kieszonkowy"] },
  { id: "library", categories: ["biblioteka"] },
  { id: "stop", categories: ["przystanek"] },
] as const satisfies readonly { id: string; categories: readonly PlaceCategory[] }[];

export type IndexGroupId = (typeof INDEX_GROUPS)[number]["id"];

/** Which index groups are within reach, from the per-category counts of a nearby result. */
export function indexGroups(counts: Record<string, number>): { id: IndexGroupId; present: boolean }[] {
  return INDEX_GROUPS.map((g) => ({ id: g.id, present: g.categories.some((c) => (counts[c] ?? 0) > 0) }));
}
