"use client";

import { type RefObject, useEffect, useLayoutEffect, useRef } from "react";

const PHONE = "(max-width: 767.98px)";
const DURATION_MS = 300;
// iOS-like sheet easing: quick start, soft landing.
const EASING = "cubic-bezier(0.32, 0.72, 0, 1)";

/**
 * Smooth height changes of a phone bottom sheet. Sheets size to their content ("auto"), which CSS
 * cannot animate, so the hook keeps the last rendered height and, when `state` changes, animates
 * from it to the new one. A sheet released after a drag animates from where the finger left it.
 * While `following` (a finger drives the height) nothing animates. Off on desktop and with "reduce motion".
 */
export function useSheetAnimation(ref: RefObject<HTMLElement | null>, state: unknown, following = false) {
  const lastHeight = useRef<number | null>(null);

  // Track the height between state changes (content loads, drags, the animation itself).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      lastHeight.current = el.getBoundingClientRect().height;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const from = lastHeight.current;
    const to = el.getBoundingClientRect().height;
    lastHeight.current = to;
    if (following) {
      for (const a of el.getAnimations()) a.cancel();
      return;
    }
    if (from === null || Math.abs(from - to) < 2) return;
    if (!window.matchMedia(PHONE).matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.animate([{ height: `${from}px` }, { height: `${to}px` }], { duration: DURATION_MS, easing: EASING });
  }, [ref, state, following]);
}
