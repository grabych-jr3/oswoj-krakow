// Life scenarios (B4) per locale; the agent's get_scenario tool reads from here.
import type { Locale } from "@/contracts/common";
import { Scenario } from "@/contracts/kb";
import scenariosEn from "../../../../data/kb/scenarios.en.json";
import scenariosPl from "../../../../data/kb/scenarios.pl.json";
import scenariosUk from "../../../../data/kb/scenarios.uk.json";

// Parsing at load fails fast if a scenarios file drifts from the contract.
const scenarios: Record<Locale, Scenario[]> = {
  pl: Scenario.array().parse(scenariosPl),
  uk: Scenario.array().parse(scenariosUk),
  en: Scenario.array().parse(scenariosEn),
};

export function listScenarioIds(locale: Locale): string[] {
  return scenarios[locale].map((s) => s.id);
}

/** Scenario in the requested locale, falling back to Polish (the source language). */
export function getScenario(id: string, locale: Locale): Scenario | null {
  return (
    scenarios[locale].find((s) => s.id === id) ??
    scenarios.pl.find((s) => s.id === id) ??
    null
  );
}
