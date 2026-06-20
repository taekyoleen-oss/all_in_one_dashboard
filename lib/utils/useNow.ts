"use client";

/**
 * useNow — a self-updating "current time" hook for live widgets (clock, dday).
 *
 *  Subscribes to a timer in an effect and stores the latest Date in state. This
 *  is a genuine external-source subscription (the wall clock), not setState
 *  during render — the canonical, React-19-safe pattern for a ticking value.
 *
 *  SSR note: the initial value is taken at mount; render time text with
 *  `suppressHydrationWarning` because server and client clocks differ by design.
 */

import * as React from "react";

export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = React.useState<Date>(() => new Date());

  React.useEffect(() => {
    // Tick on a fixed interval. For second-resolution clocks this is plenty
    // accurate; we re-read Date.now() each tick so drift can't accumulate.
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return now;
}

export default useNow;
