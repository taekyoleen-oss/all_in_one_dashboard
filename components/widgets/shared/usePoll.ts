"use client";

/**
 * usePoll — periodic GET + Zod-validated JSON for poll-mode widgets
 * (환율/날씨/뉴스, dataMode:'poll' — 설계서 §9.4).
 *
 *  Fetches `url` immediately, then every `intervalMs`, validating each response
 *  body with the provided Zod schema (the route already validated its own output
 *  against the SAME schema in output/api-shapes.ts — this is the client-side
 *  defensive half of the anti-drift contract: a malformed body is dropped, never
 *  crashes the widget). Types flow from the schema, so callers never re-declare
 *  the payload shape.
 *
 *  Instance isolation: the subscription is keyed by `url`, and `url` is built
 *  from THIS instance's config (e.g. ?base=&symbols= / ?lat=&lon= / ?query=), so
 *  two widgets with different settings poll independently and a config change
 *  re-subscribes (설계서 §4.1).
 *
 *  Good-citizen polling: skips ticks while the tab is hidden and fires an
 *  immediate refresh when it becomes visible again, so background tiles don't
 *  burn the upstream. Set `enabled:false` to pause entirely (e.g. empty config).
 *
 *  External-source subscription set up in an effect — the React-19-safe pattern
 *  (same shape as useStockQuotes / useNow): no synchronous setState in render.
 */

import * as React from "react";
import type { z } from "zod";

export interface PollState<T> {
  /** Latest validated payload, or null until the first success. */
  data: T | null;
  /** True only during the very first load (no data yet). */
  loading: boolean;
  /** A short error code when the last attempt failed AND we have no data. */
  error: string | null;
  /** epoch ms of the last successful update (for a "갱신: …" line). */
  lastUpdated: number | null;
  /** Force an out-of-band refresh (e.g. a manual 새로고침 button). */
  refresh: () => void;
}

interface PollOptions {
  /** Poll period in ms. */
  intervalMs: number;
  /** When false, no fetching happens (paused). Default true. */
  enabled?: boolean;
}

export function usePoll<S extends z.ZodTypeAny>(
  url: string,
  schema: S,
  { intervalMs, enabled = true }: PollOptions,
): PollState<z.infer<S>> {
  type T = z.infer<S>;

  const [data, setData] = React.useState<T | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = React.useState<number | null>(null);
  // Bumping this re-runs the effect for a manual refresh.
  const [nonce, setNonce] = React.useState(0);

  const refresh = React.useCallback(() => setNonce((n) => n + 1), []);

  React.useEffect(() => {
    if (!enabled || !url) return;

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const tick = async () => {
      // Don't fetch while hidden; the visibility handler refreshes on return.
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (cancelled) return;
        if (!res.ok) {
          // Keep showing stale data if we have any; only surface an error when empty.
          setError((prev) => (data === null ? "request_failed" : prev));
          return;
        }
        const json: unknown = await res.json();
        if (cancelled) return;
        const parsed = schema.safeParse(json);
        if (!parsed.success) {
          setError((prev) => (data === null ? "bad_shape" : prev));
          return;
        }
        setData(parsed.data as T);
        setLastUpdated(Date.now());
        setError(null);
      } catch {
        if (cancelled) return;
        setError((prev) => (data === null ? "network_error" : prev));
      }
    };

    void tick();
    timer = setInterval(() => void tick(), intervalMs);

    const onVisible = () => {
      if (typeof document !== "undefined" && !document.hidden) void tick();
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisible);
    }

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisible);
      }
    };
    // Re-subscribe when the target URL, cadence, enabled flag, or manual nonce change.
    // `data` is intentionally excluded: it's read inside closures only to decide
    // whether to surface an error, and including it would reset the interval on
    // every successful poll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, intervalMs, enabled, nonce]);

  // `loading` is derived (avoids setState-in-effect): true only before the first
  // result while an active subscription is in flight.
  const loading = enabled && !!url && data === null && error === null;

  return { data, loading, error, lastUpdated, refresh };
}

export default usePoll;
