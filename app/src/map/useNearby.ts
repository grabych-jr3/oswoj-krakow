"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GeocodeResult, NearbyResult, TravelMode } from "@/contracts/geo";
import { fetchNearby, NearbyError } from "./nearby";

export type NearbyState = {
  /** The picked point. A map click starts without an address; the service's label replaces it. */
  origin: GeocodeResult;
  mode: TravelMode;
  status: "loading" | "ready" | "error";
  result: NearbyResult | null;
  error: NearbyError["kind"] | null;
  /** Free tag of the caller, kept with the request (AppShell stores the chat map view it replaced). */
  tag?: string;
};

/**
 * "Kraków w 15 minut" (C4): the picked point, the travel mode and the reachability from /api/nearby.
 * `onReady` gets the named point each time a result arrives.
 */
export function useNearby(onReady?: (origin: GeocodeResult) => void) {
  const [state, setState] = useState<NearbyState | null>(null);
  const request = useRef<AbortController | null>(null);
  const readyCallback = useRef(onReady);
  useEffect(() => {
    readyCallback.current = onReady;
  }, [onReady]);

  const run = useCallback((origin: GeocodeResult, mode: TravelMode, tag?: string) => {
    request.current?.abort();
    const ctrl = new AbortController();
    request.current = ctrl;
    setState({ origin, mode, status: "loading", result: null, error: null, tag });
    fetchNearby(origin.coords, mode, ctrl.signal)
      .then((result) => {
        if (ctrl.signal.aborted) return;
        // Keep the address the user chose; a bare map point takes the nearest address from the service.
        const label = origin.precision === "approx" ? result.origin.label : origin.label;
        setState((s) => (s ? { ...s, origin: { ...origin, label }, status: "ready", result } : s));
        readyCallback.current?.({ ...origin, label });
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return;
        setState((s) => (s ? { ...s, status: "error", error: e instanceof NearbyError ? e.kind : "failed" } : s));
      });
  }, []);

  const setMode = useCallback(
    (mode: TravelMode) => {
      if (state && mode !== state.mode) run(state.origin, mode, state.tag);
    },
    [state, run],
  );

  const retry = useCallback(() => {
    if (state) run(state.origin, state.mode, state.tag);
  }, [state, run]);

  const clear = useCallback(() => {
    request.current?.abort();
    setState(null);
  }, []);

  return { state, run, setMode, retry, clear };
}

/** A map point as a GeocodeResult until the service names it. */
export function pointOrigin(coords: [number, number]): GeocodeResult {
  return { label: `${coords[1].toFixed(5)}, ${coords[0].toFixed(5)}`, coords, district: null, precision: "approx" };
}
