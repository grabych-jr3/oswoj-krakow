import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import nearbyFixture from "@/contracts/fixtures/nearby.sample.json";
import placesFixture from "@/contracts/fixtures/places.sample.json";
import sa34Fixture from "@/contracts/fixtures/procedure.SA-34.json";
import type { Place } from "@/contracts/place";
import { parseToolPart } from "@/lib/toolParts";
import { deriveChatMap, messageMarkers } from "./chatMap";

const places = (placesFixture as Place[]).slice(0, 3).map((p, i) => ({ ...p, distanceM: 100 * (i + 1), label: String(i + 1) }));

let n = 0;
function toolPart(name: string, output: unknown, state = "output-available") {
  n += 1;
  return { type: `tool-${name}`, toolCallId: `call_${n}`, state, input: {}, output } as unknown as UIMessage["parts"][number];
}
const assistant = (...parts: UIMessage["parts"]): UIMessage => ({ id: `m${++n}`, role: "assistant", parts });
const user = (text: string): UIMessage => ({ id: `u${++n}`, role: "user", parts: [{ type: "text", text }] });

describe("parseToolPart", () => {
  it("validates outputs against the contract", () => {
    expect(parseToolPart(toolPart("find_places", { center: null, places }))).toMatchObject({ state: "done", name: "find_places" });
    expect(parseToolPart(toolPart("find_places", { places: "nope" }))).toMatchObject({ state: "error", output: null });
  });

  it("reports running tools and ignores text and unknown tools", () => {
    expect(parseToolPart(toolPart("geocode", undefined, "input-available"))).toMatchObject({ state: "running" });
    expect(parseToolPart({ type: "text", text: "hi" })).toBeNull();
    expect(parseToolPart(toolPart("delete_everything", {}))).toBeNull();
  });
});

describe("deriveChatMap", () => {
  it("shows numbered places of the newest answer", () => {
    const view = deriveChatMap([user("q"), assistant({ type: "text", text: "(1)" }, toolPart("find_places", { center: null, places }))]);
    expect(view?.markers.map((m) => m.label)).toEqual(["1", "2", "3"]);
    expect(view?.area).toBeNull();
  });

  it("prefers places over procedure offices within one answer", () => {
    const sa34 = { ...sa34Fixture, offices: sa34Fixture.offices.map((o) => ({ ...o, coords: [19.94, 50.06] })) };
    const view = deriveChatMap([
      assistant(toolPart("find_places", { center: null, places }), toolPart("get_procedure", { procedure: sa34 })),
    ]);
    expect(view?.markers).toHaveLength(places.length);
  });

  it("numbers geocoded offices of a procedure in card order", () => {
    const offices = sa34Fixture.offices.map((o, i) => ({ ...o, coords: i === 1 ? null : [19.94 + i / 100, 50.06] }));
    const view = deriveChatMap([assistant(toolPart("get_procedure", { procedure: { ...sa34Fixture, offices } }))]);
    expect(view?.markers.map((m) => m.label)).toEqual(["1", "3"]);
    expect(view?.markers[0].place.category).toBe("urzad");
  });

  it("draws the zone and origin of a 15-minute answer, with unnumbered places", () => {
    const view = deriveChatMap([assistant(toolPart("nearby_15min", nearbyFixture))]);
    expect(view?.area?.geometry.type).toBe("Polygon");
    expect(view?.origin?.coords).toEqual(nearbyFixture.origin.coords);
    expect(view?.markers.every((m) => m.label === null)).toBe(true);
  });

  it("keeps the last map view when a later answer has none", () => {
    const first = assistant(toolPart("find_places", { center: null, places }));
    const view = deriveChatMap([first, user("thanks"), assistant({ type: "text", text: "You're welcome" })]);
    expect(view?.markers).toHaveLength(3);
    expect(deriveChatMap([user("hi")])).toBeNull();
  });
});

describe("messageMarkers", () => {
  it("maps marker labels of an answer to places", () => {
    const markers = messageMarkers(assistant(toolPart("find_places", { center: null, places })));
    expect(markers.get("2")?.id).toBe(places[1].id);
  });
});
