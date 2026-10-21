import { describe, expect, it } from "vitest";
import type { LngLat } from "@/contracts/common";
import { DistrictStats } from "@/contracts/place";
import { districts } from "./districts";

// Reference points checked against the full MSIP district layer.
const RYNEK: LngLat = [19.9373, 50.0617]; // I Stare Miasto
const PLAC_NOWY: LngLat = [19.9446, 50.0515]; // I Stare Miasto, ~600 m from Podgórze across the Vistula
const WIELICKA_28: LngLat = [19.965631, 50.040222]; // XIII Podgórze
const KOPIEC_KRAKUSA: LngLat = [19.9585, 50.0381]; // XIII Podgórze
const NOWA_HUTA_PLAC_CENTRALNY: LngLat = [20.0377, 50.0716]; // XVIII Nowa Huta

describe("districts", () => {
  it("has all 18 districts with contract-valid stats", () => {
    for (let n = 1; n <= 18; n++) {
      const d = DistrictStats.parse(districts.getDistrict(n));
      expect(d.number).toBe(n);
      expect(d.residents).toBeGreaterThan(0);
      expect(d.topCitizenships.length).toBeLessThanOrEqual(5);
    }
    expect(districts.getDistrict(0)).toBeNull();
    expect(districts.getDistrict(19)).toBeNull();
  });

  it("finds the district of a point", () => {
    expect(districts.getDistrict(RYNEK)?.name).toBe("Stare Miasto");
    expect(districts.getDistrict(PLAC_NOWY)?.number).toBe(1);
    expect(districts.getDistrict(WIELICKA_28)?.name).toBe("Podgórze");
    expect(districts.getDistrict(KOPIEC_KRAKUSA)?.number).toBe(13);
    expect(districts.getDistrict(NOWA_HUTA_PLAC_CENTRALNY)?.name).toBe("Nowa Huta");
    expect(districts.getDistrict([19.8, 50.25])).toBeNull(); // outside Kraków
  });

  it("has plausible city totals", () => {
    // Exact sums are cross-checked against the source by `uv run geo-districts` (reports/districts.md).
    let residents = 0;
    let foreigners = 0;
    for (let n = 1; n <= 18; n++) {
      residents += districts.getDistrict(n)?.residents ?? 0;
      foreigners += districts.getDistrict(n)?.foreigners ?? 0;
    }
    expect(residents).toBeGreaterThan(600_000);
    expect(residents).toBeLessThan(900_000);
    expect(foreigners).toBeGreaterThan(5_000);
    expect(foreigners).toBeLessThan(residents);
  });

  it("lists countries only in top citizenships", () => {
    for (let n = 1; n <= 18; n++) {
      for (const c of districts.getDistrict(n)?.topCitizenships ?? []) {
        expect(["Inne Kraje", "Nieustalone", "Bezpaństwowcy"]).not.toContain(c.name);
      }
    }
  });
});
