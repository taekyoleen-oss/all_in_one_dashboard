"use client";

/**
 * useFxRates — poll /api/fx for one base + quote set, tracking per-pair
 * direction across successive polls (설계서 §2.2, dataMode:'poll').
 *
 *  Builds the request URL from THIS instance's config (base + quotes), so two fx
 *  widgets poll independently (격리). Types are IMPORTED from output/api-shapes.ts
 *  (FxRates) — never re-declared. Direction is derived CLIENT-side by remembering
 *  the previous rate per quote (the server only publishes the level).
 */

import * as React from "react";
import { FxRatesSchema, type FxRates } from "@/output/api-shapes";
import { usePoll } from "@/components/widgets/shared/usePoll";
import { fxDirection, fxDirectionFromPct, type FxDirection } from "./format";

/** Poll cadence for FX (rates are daily; 60s keeps the badge/time fresh). */
export const FX_REFRESH_MS = 60_000;

export interface FxRow {
  quote: string;
  rate: number;
  direction: FxDirection;
  /** 전일 대비 percent (signed) when the source provides it. */
  changePct?: number;
}

export interface FxRatesState {
  base: string;
  rows: FxRow[];
  date: string | null;
  stale: boolean;
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
  refresh: () => void;
}

export function useFxRates(base: string, quotes: string[]): FxRatesState {
  const symbols = quotes.join(",");
  const url = `/api/fx?base=${encodeURIComponent(base)}&symbols=${encodeURIComponent(symbols)}`;
  const enabled = quotes.length > 0;

  const poll = usePoll<typeof FxRatesSchema>(url, FxRatesSchema, {
    intervalMs: FX_REFRESH_MS,
    enabled,
  });

  const { data, lastUpdated } = poll;

  // Direction (this poll's rate vs. the PREVIOUS poll's) is computed client-side,
  // since the server only publishes the current level. We derive `rows` during
  // render and cache them in state, "adjusting state during render" when a new
  // poll (or quote set) lands — the React-sanctioned pattern for deriving from a
  // previous render's value
  // (https://react.dev/reference/react/useState#storing-information-from-previous-renders).
  // This avoids reading/writing a ref in render AND setState-in-effect. The
  // cached `prevRates`/`rows` only advance when `key` changes, so the comparison
  // baseline is the genuinely previous poll (not the current one).
  const key = `${lastUpdated ?? "none"}|${symbols}`;
  const [cache, setCache] = React.useState<{
    key: string;
    rows: FxRow[];
    prevRates: Record<string, number>;
  }>({ key: "", rows: [], prevRates: {} });

  let rows = cache.rows;
  if (cache.key !== key) {
    const currentRates = (data as FxRates | null)?.rates ?? {};
    const changePct = (data as FxRates | null)?.changePct;
    const out: FxRow[] = [];
    if (data) {
      for (const q of quotes) {
        const rate = currentRates[q];
        if (typeof rate !== "number") continue;
        const cp = changePct?.[q];
        // Prefer the server's 전일 대비 change; fall back to poll-to-poll motion.
        const direction =
          typeof cp === "number"
            ? fxDirectionFromPct(cp)
            : fxDirection(rate, cache.prevRates[q]);
        out.push({ quote: q, rate, direction, changePct: cp });
      }
    }
    rows = out;
    // Advance the baseline: the rates we just rendered become "previous" for the
    // next poll's comparison.
    setCache({ key, rows: out, prevRates: currentRates });
  }

  return {
    base: poll.data?.base ?? base,
    rows,
    date: poll.data?.date ?? null,
    stale: poll.data?.stale ?? false,
    loading: poll.loading,
    error: poll.error,
    lastUpdated: poll.lastUpdated,
    refresh: poll.refresh,
  };
}

export default useFxRates;
