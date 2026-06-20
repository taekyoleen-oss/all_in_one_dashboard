"use client";

/**
 * image-slider · useAutoAdvance — ticking slide index with manual controls.
 *
 *  Advances the index on an interval (a genuine timer subscription, like useNow —
 *  React-19-safe: state updates happen in the interval callback / event handlers,
 *  never during render). Auto-advance is DISABLED when the user prefers reduced
 *  motion or when intervalSec is 0 / there are <2 slides. The returned `index` is
 *  always clamped to [0, count) via modulo, so removing images can't point out of
 *  range.
 */

import * as React from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** Subscribe to the reduced-motion media query as an external store (no setState-in-effect). */
function subscribeReducedMotion(onChange: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia(REDUCED_MOTION_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getReducedMotionSnapshot(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(REDUCED_MOTION_QUERY).matches
  );
}

/** SSR snapshot: assume motion is allowed (the client re-reads on mount). */
function getReducedMotionServerSnapshot(): boolean {
  return false;
}

/** True when the user prefers reduced motion (live, via useSyncExternalStore). */
function useReducedMotion(): boolean {
  return React.useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );
}

export interface AutoAdvanceApi {
  /** Current slide index, clamped to [0, count). */
  index: number;
  /** Go to the previous slide (wraps). */
  prev: () => void;
  /** Go to the next slide (wraps). */
  next: () => void;
  /** Jump to a specific slide. */
  goTo: (i: number) => void;
  /** True when auto-advance is actually running. */
  playing: boolean;
}

export function useAutoAdvance(count: number, intervalSec: number): AutoAdvanceApi {
  const [raw, setRaw] = React.useState(0);
  // Clamp for reads (count can shrink below raw after a removal).
  const index = count > 0 ? ((raw % count) + count) % count : 0;

  const next = React.useCallback(() => setRaw((i) => i + 1), []);
  const prev = React.useCallback(() => setRaw((i) => i - 1), []);
  const goTo = React.useCallback((i: number) => setRaw(i), []);

  const reduced = useReducedMotion();
  const playing = !reduced && intervalSec > 0 && count > 1;

  React.useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(
      () => setRaw((i) => i + 1),
      intervalSec * 1000,
    );
    return () => window.clearInterval(id);
  }, [playing, intervalSec]);

  return { index, prev, next, goTo, playing };
}

export default useAutoAdvance;
