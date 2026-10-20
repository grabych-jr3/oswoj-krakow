// Handlers of the knowledge tools: search_procedures, get_procedure, get_scenario.
import type { z } from "zod";
import type { ToolOutputs } from "@/contracts/chat";
import type { Locale } from "@/contracts/common";
import type { LifeTag } from "@/contracts/kb";
import type { GeoService } from "@/server/geo";
import { getProcedure, searchProcedures } from "../kb/procedures";
import { getScenario } from "../kb/scenarios";
import { ToolError } from "./errors";

type Output<Name extends keyof typeof ToolOutputs> = z.infer<(typeof ToolOutputs)[Name]>;

export function runSearchProcedures(input: {
  query_pl: string;
  tags?: z.infer<typeof LifeTag>[];
}): Output<"search_procedures"> {
  return { hits: searchProcedures(input.query_pl, { tags: input.tags }) };
}

/** The procedure card with every office's coords taken from the "urzad" layer of zone A. */
export async function runGetProcedure(
  input: { symbol: string },
  geo: Pick<GeoService, "getPlace">,
): Promise<Output<"get_procedure">> {
  const procedure = getProcedure(input.symbol);
  if (!procedure) {
    throw new ToolError(`Unknown procedure symbol "${input.symbol}". Use search_procedures to find the right one.`);
  }
  const offices = await Promise.all(
    procedure.offices.map(async (office) => {
      // A missing or failed lookup keeps coords null: the card is still useful without a marker.
      const place = await geo.getPlace(office.id).catch(() => null);
      return { ...office, coords: place?.coords ?? null };
    }),
  );
  return { procedure: { ...procedure, offices } };
}

export function runGetScenario(input: { id: string; locale?: Locale }, defaultLocale: Locale): Output<"get_scenario"> {
  const scenario = getScenario(input.id, input.locale ?? defaultLocale);
  if (!scenario) throw new ToolError(`Unknown scenario id "${input.id}".`);
  return { scenario };
}
