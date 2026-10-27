// Agent tool set (PLAN.md §6.B): names and outputs strictly follow ToolOutputs, which the UI (zone C) renders.
import { tool } from "ai";
import { z } from "zod";
import { ToolOutputs } from "@/contracts/chat";
import type { LngLat, Locale } from "@/contracts/common";
import { TravelMode } from "@/contracts/geo";
import { LifeTag } from "@/contracts/kb";
import { PlaceCategory } from "@/contracts/place";
import type { GeoService } from "@/server/geo";
import { listScenarioIds } from "../kb/scenarios";
import {
  procedureForModel,
  runGetProcedure,
  runGetScenario,
  runSearchProcedures,
  scenarioForModel,
  searchForModel,
} from "./knowledge";
import { findPlacesForModel, nearbyForModel, runFindPlaces, runGeocode, runNearby } from "./places";

export { ToolError } from "./errors";

const scenarioIds = listScenarioIds("pl") as [string, ...string[]];

// Gemini rejects the JSON Schema of a tuple, so tool inputs take [lng, lat] as a two-number array.
const LngLatInput = z
  .array(z.number())
  .length(2)
  .describe("[lng, lat]")
  .transform((v): LngLat => [v[0], v[1]]);

export interface ToolContext {
  geo: GeoService;
  locale: Locale;
  /** Point the user already picked on the map, used when nearby_15min gets no address. */
  mapOrigin: LngLat | null;
}

export function buildTools({ geo, locale, mapOrigin }: ToolContext) {
  return {
    search_procedures: tool({
      description:
        "Full-text search over Kraków city procedures (BIP cards). Always query in Polish, translating the user's words " +
        "into official Polish terms (e.g. 'zameldowanie', 'PESEL', 'rejestracja pojazdu'). Returns up to 8 hits with symbols.",
      inputSchema: z.object({
        query_pl: z.string().min(2).describe("Search query in Polish"),
        tags: z.array(LifeTag).optional().describe("Optional life-situation filter"),
      }),
      outputSchema: ToolOutputs.search_procedures,
      execute: (input) => runSearchProcedures(input),
      toModelOutput: ({ output }) => ({ type: "json", value: searchForModel(output) }),
    }),

    get_procedure: tool({
      description:
        "Full card of one procedure by its symbol (letters, hyphen, number): required documents, fees, deadlines, offices with hours. " +
        "The only source for these facts.",
      inputSchema: z.object({ symbol: z.string().describe("Procedure symbol exactly as search_procedures or get_scenario returned it") }),
      outputSchema: ToolOutputs.get_procedure,
      execute: (input) => runGetProcedure(input, geo, locale),
      toModelOutput: ({ output }) => ({ type: "json", value: procedureForModel(output) }),
    }),

    get_scenario: tool({
      description: "Step-by-step checklist for a life situation of a new Kraków resident.",
      inputSchema: z.object({
        id: z.enum(scenarioIds),
        locale: z.enum(["pl", "uk", "en"]).optional().describe("Defaults to the user's interface language"),
      }),
      outputSchema: ToolOutputs.get_scenario,
      execute: (input) => runGetScenario(input, locale),
      toModelOutput: ({ output }) => ({ type: "json", value: scenarioForModel(output) }),
    }),

    find_places: tool({
      description:
        "City places to show on the map (kindergartens, schools, libraries, parks, stops, offices…), " +
        "optionally near an address or coordinates, or in a district. Refer to results by their marker label. " +
        "Kindergarten / preschool (ages 3–6) is przedszkole; nursery / crèche (under 3) is zlobek. " +
        "Each place has attrs for comparing size: kindergartens and schools give children / students and groups, " +
        "nurseries give places, parks give area_ha. Ask for a larger limit when the user wants the biggest ones.",
      inputSchema: z.object({
        categories: z.array(PlaceCategory).min(1),
        near: LngLatInput.optional(),
        address: z.string().optional().describe("Address in Kraków to search around"),
        // A plain string: Gemini rejects union schemas, and the model knows names better than numbers.
        district: z.string().min(1).optional().describe("District name, e.g. 'Podgórze', or its number 1-18"),
        text: z.string().optional().describe("Part of a place name"),
        limit: z.number().int().min(1).max(20).optional(),
      }),
      outputSchema: ToolOutputs.find_places,
      execute: (input) => runFindPlaces(input, geo),
      toModelOutput: ({ output }) => ({ type: "json", value: findPlacesForModel(output) }),
    }),

    nearby_15min: tool({
      description:
        "What is reachable within 15 minutes from a point: zone on the map, places by category and the 15-minute index. " +
        "Without address or coords, uses the point the user picked on the map.",
      inputSchema: z.object({
        address: z.string().optional(),
        coords: LngLatInput.optional(),
        mode: TravelMode.default("walk"),
      }),
      outputSchema: ToolOutputs.nearby_15min,
      execute: (input) => runNearby(input, geo, mapOrigin),
      toModelOutput: ({ output }) => ({ type: "json", value: nearbyForModel(output) }),
    }),

    geocode: tool({
      description: "Turn a Kraków address into coordinates and district. Use when the user's address is ambiguous.",
      inputSchema: z.object({ query: z.string().min(2) }),
      outputSchema: ToolOutputs.geocode,
      execute: (input) => runGeocode(input, geo),
    }),
  };
}

export type AgentTools = ReturnType<typeof buildTools>;
