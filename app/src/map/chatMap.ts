import type { UIMessage } from "ai";
import type { LngLat } from "@/contracts/common";
import type { NearbyResult } from "@/contracts/geo";
import type { Office, Procedure } from "@/contracts/kb";
import type { Place } from "@/contracts/place";
import { type ParsedToolPart, toolParts } from "@/lib/toolParts";

/** A place the assistant put on the map. `label` is the marker number the answer refers to, e.g. "(1)". */
export type ChatMarker = { key: string; label: string | null; place: Place };

/** What the latest answer shows on the map (PLAN.md §5.3, "Як UI рендерить інструменти"). */
export type ChatMapView = {
  /** Changes with every new tool result: the map fits its bounds once per key. */
  key: string;
  markers: ChatMarker[];
  area: NearbyResult["area"] | null;
  origin: { label: string; coords: LngLat } | null;
};

/** A procedure office as a map place (offices carry coords once the agent has geocoded them). */
export function officeToPlace(office: Office, procedure: Procedure): Place | null {
  if (!office.coords) return null;
  return {
    id: office.id,
    category: "urzad",
    name: office.name,
    address: office.address,
    coords: office.coords,
    district: null,
    phone: office.phone,
    url: office.bookingUrl,
    attrs: { hours: office.hours },
    source: { dataset: "bip", url: procedure.bipUrl, updatedAt: procedure.publishedAt },
  };
}

/** Office markers are numbered by their position in the card, so the card and the map agree. */
export function officeMarkers(procedure: Procedure): ChatMarker[] {
  return procedure.offices.flatMap((o, i) => {
    const place = officeToPlace(o, procedure);
    return place ? [{ key: `${procedure.symbol}:${o.id}`, label: String(i + 1), place }] : [];
  });
}

type SourcedView = ChatMapView & { fromProcedure: boolean };

function viewOf(part: ParsedToolPart): SourcedView | null {
  if (part.state !== "done" || !part.output) return null;
  switch (part.name) {
    case "find_places":
      return {
        key: part.id,
        markers: part.output.places.map((p) => ({ key: `${part.id}:${p.id}`, label: p.label, place: p })),
        area: null,
        origin: null,
        fromProcedure: false,
      };
    case "nearby_15min":
      return {
        key: part.id,
        // The agent does not number these: they show as category dots inside the zone.
        markers: part.output.places.map((p) => ({ key: `${part.id}:${p.id}`, label: null, place: p })),
        area: part.output.area,
        origin: part.output.origin,
        fromProcedure: false,
      };
    case "get_procedure": {
      const markers = officeMarkers(part.output.procedure);
      return markers.length ? { key: part.id, markers, area: null, origin: null, fromProcedure: true } : null;
    }
    default:
      return null;
  }
}

/**
 * Map view of the newest answer that has one. Within an answer, places and the 15-minute zone win over
 * procedure offices, because the answer text numbers the places, e.g. "(1)".
 */
export function deriveChatMap(messages: UIMessage[]): ChatMapView | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role !== "assistant") continue;
    const views = toolParts(messages[i]).flatMap((p) => viewOf(p) ?? []);
    if (!views.length) continue;
    const best = views.findLast((v) => !v.fromProcedure) ?? views[views.length - 1];
    return { key: best.key, markers: best.markers, area: best.area, origin: best.origin };
  }
  return null;
}

/** Numbered places of one answer, for the clickable "(1)" references in its text. */
export function messageMarkers(message: UIMessage): Map<string, Place> {
  const byLabel = new Map<string, Place>();
  for (const part of toolParts(message)) {
    if (part.state !== "done" || !part.output) continue;
    if (part.name === "find_places") for (const p of part.output.places) byLabel.set(p.label, p);
  }
  return byLabel;
}
