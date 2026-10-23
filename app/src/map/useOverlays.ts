"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TravelMode } from "@/contracts/geo";
import { fetchAccessIndex, fetchDistricts } from "./overlays";

export type Load<T> = { status: "idle" | "loading" | "ready" | "error"; data: T | null };

/** Loads a file once, on first use; after a failure the next call tries again. */
function useLazy<T>(load: () => Promise<T>, what: string) {
  const [state, setState] = useState<Load<T>>({ status: "idle", data: null });
  const busy = useRef(false);
  const ensure = useCallback(() => {
    if (busy.current) return;
    busy.current = true;
    setState({ status: "loading", data: null });
    load()
      .then((data) => setState({ status: "ready", data }))
      .catch((e) => {
        console.error(`[map] cannot load ${what}`, e);
        busy.current = false;
        setState({ status: "error", data: null });
      });
  }, [load, what]);
  return [state, ensure] as const;
}

/** City overlays (C5): the "Indeks 15 minut" heat map (S1) and the district borders with statistics. */
export function useOverlays() {
  const [indexOn, setIndexOn] = useState(false);
  const [indexMode, setIndexMode] = useState<TravelMode>("walk");
  // Districts are on from the start: the borders help to read the map.
  const [districtsOn, setDistrictsOn] = useState(true);
  const [index, loadIndex] = useLazy(fetchAccessIndex, "the 15-minute index");
  const [districts, loadDistricts] = useLazy(fetchDistricts, "districts");
  useEffect(() => {
    loadDistricts();
  }, [loadDistricts]);

  const toggleIndex = useCallback(() => {
    loadIndex();
    setIndexOn((on) => !on);
  }, [loadIndex]);

  const toggleDistricts = useCallback(() => {
    loadDistricts();
    setDistrictsOn((on) => !on);
  }, [loadDistricts]);

  return { indexOn, indexMode, setIndexMode, index, toggleIndex, districtsOn, districts, toggleDistricts };
}

export type Overlays = ReturnType<typeof useOverlays>;
