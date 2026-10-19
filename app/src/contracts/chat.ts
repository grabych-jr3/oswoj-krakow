// app/src/contracts/chat.ts
import { z } from "zod";
import { LngLat, Locale } from "./common";
import { GeocodeResult, NearbyResult } from "./geo";
import { Procedure, Scenario } from "./kb";
import { Place } from "./place";

/** POST /api/chat (B) — потік UI-повідомлень Vercel AI SDK */
export const ChatRequestBody = z.object({
  messages: z.array(z.any()),          // UIMessage[]
  locale: Locale,
  map: z.object({ center: LngLat, zoom: z.number(), origin: GeocodeResult.nullable() }).optional(),
});

/** Вихід інструментів = те, що UI (C) малює в чаті й на карті */
export const ToolOutputs = {
  search_procedures: z.object({
    hits: z.array(z.object({ symbol: z.string(), title: z.string(), snippet: z.string(), bipUrl: z.string().url() })),
  }),
  get_procedure: z.object({ procedure: Procedure }),   // offices уже з coords
  get_scenario: z.object({ scenario: Scenario }),
  find_places: z.object({
    center: LngLat.nullable(),
    places: z.array(Place.extend({ distanceM: z.number().nullable(), label: z.string() })), // label "1","2"… = номер маркера
  }),
  nearby_15min: NearbyResult,
  geocode: z.object({ results: z.array(GeocodeResult) }),
} as const;
export type ToolName = keyof typeof ToolOutputs;
