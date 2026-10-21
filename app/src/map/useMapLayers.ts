"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Place, PlaceCategory } from "@/contracts/place";
import { fetchLayer, fetchLayerIndex, type LayerInfo } from "./places";

/** Layer index, enabled categories and loaded places for the map (C2). Layers load lazily when enabled. */
export function useMapLayers() {
  const [index, setIndex] = useState<LayerInfo[] | null>(null);
  const [error, setError] = useState(false);
  const [enabled, setEnabled] = useState<Set<PlaceCategory>>(new Set());
  const [loaded, setLoaded] = useState<Partial<Record<PlaceCategory, Place[]>>>({});
  const [failed, setFailed] = useState<Set<PlaceCategory>>(new Set());
  const requested = useRef(new Set<PlaceCategory>());

  useEffect(() => {
    let cancelled = false;
    fetchLayerIndex()
      .then((idx) => {
        if (cancelled) return;
        setIndex(idx);
        setEnabled(new Set(idx.map((c) => c.category))); // everything visible at first
      })
      .catch((e) => {
        console.error("[map] cannot load layer index", e);
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch each enabled layer once; results arrive asynchronously.
  useEffect(() => {
    for (const c of enabled) {
      if (requested.current.has(c)) continue;
      requested.current.add(c);
      fetchLayer(c)
        .then((places) => setLoaded((l) => ({ ...l, [c]: places })))
        .catch((e) => {
          console.error(`[map] cannot load layer ${c}`, e);
          setFailed((f) => new Set(f).add(c));
        });
    }
  }, [enabled]);

  const loading = useMemo(
    () => new Set([...enabled].filter((c) => !loaded[c] && !failed.has(c))),
    [enabled, loaded, failed],
  );
  const places = useMemo(() => [...enabled].flatMap((c) => loaded[c] ?? []), [enabled, loaded]);
  const byId = useMemo(() => new Map(Object.values(loaded).flat().map((p) => [p.id, p])), [loaded]);

  const toggle = useCallback((c: PlaceCategory) => {
    setEnabled((s) => {
      const next = new Set(s);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  }, []);

  const setAll = useCallback(
    (on: boolean) => setEnabled(on && index ? new Set(index.map((c) => c.category)) : new Set()),
    [index],
  );

  return { index, error, enabled, loading, places, byId, toggle, setAll };
}
