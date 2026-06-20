"use client";

/**
 * useFlash — briefly returns a "flash" direction whenever `value` changes, for
 * the per-tick update flash on a quote row. Honors prefers-reduced-motion: when
 * the user prefers reduced motion, it stays inert (no flash) so the only change
 * is the (instant) number/color update.
 *
 *  Returns "up" | "down" | null. Callers map it to a background tint that fades.
 */

import * as React from "react";

export function useFlash(value: number, durationMs = 600): "up" | "down" | null {
  const [flash, setFlash] = React.useState<"up" | "down" | null>(null);
  const prev = React.useRef<number>(value);

  React.useEffect(() => {
    const previous = prev.current;
    prev.current = value;
    if (previous === value) return;

    // Respect reduced-motion: skip the flash entirely.
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    setFlash(value > previous ? "up" : "down");
    const id = window.setTimeout(() => setFlash(null), durationMs);
    return () => window.clearTimeout(id);
  }, [value, durationMs]);

  return flash;
}

export default useFlash;
