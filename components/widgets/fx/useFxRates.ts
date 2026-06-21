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
import { fxDirectionFromPct, type FxDirection } from "./format";
import { fxUnit, foreignCurrencies, type FxConfig } from "./types";

/** Poll cadence for FX (rates are daily; 60s keeps the badge/time fresh). */
export const FX_REFRESH_MS = 60_000;

export interface FxRow {
  /** Foreign currency code (e.g. "USD", "JPY"). */
  quote: string;
  /** Quote unit (1, or 100 for JPY) — "100 JPY = …원". */
  unit: number;
  /** KRW per `unit` of the currency (the 원화 value shown). */
  krw: number;
  direction: FxDirection;
  /** 전일 대비 percent of the KRW value (signed) when available. */
  changePct?: number;
  /** 전일 대비 KRW 금액 변동 (signed) — derived from changePct + current krw. */
  changeAbs?: number;
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
  // KRW-oriented: list the foreign currencies and show 원 per unit. We fetch with
  // base=KRW (so rates[C] = C per 1 KRW) and invert to KRW-per-unit for display.
  const foreign = foreignCurrencies({ base, quotes } as FxConfig);
  const symbols = foreign.join(",");
  const enabled = foreign.length > 0;
  const url = `/api/fx?base=KRW&symbols=${encodeURIComponent(symbols)}`;

  const poll = usePoll<typeof FxRatesSchema>(url, FxRatesSchema, {
    intervalMs: FX_REFRESH_MS,
    enabled,
  });

  const data = poll.data as FxRates | null;

  // Derive rows directly from the payload (pure) — direction/% come from the
  // server's 전일 대비 changePct (no client poll-to-poll state needed).
  const rows: FxRow[] = [];
  if (data) {
    for (const c of foreign) {
      const rate = data.rates[c]; // c per 1 KRW
      if (typeof rate !== "number" || rate === 0) continue;
      const unit = fxUnit(c);
      const krw = unit / rate; // KRW per `unit` of c
      // changePct[c] is for c-per-KRW; the KRW value moves the OPPOSITE way → negate.
      const sp = data.changePct?.[c];
      const cp = typeof sp === "number" ? -sp : undefined;
      // Day-over-day KRW amount: prevKrw = krw / (1 + cp/100); Δ = krw − prevKrw.
      let changeAbs: number | undefined;
      if (typeof cp === "number" && Number.isFinite(cp)) {
        const denom = 1 + cp / 100;
        if (denom !== 0) changeAbs = krw - krw / denom;
      }
      rows.push({
        quote: c,
        unit,
        krw,
        direction: fxDirectionFromPct(cp),
        changePct: cp,
        changeAbs,
      });
    }
  }

  return {
    base: "KRW",
    rows,
    date: data?.date ?? null,
    stale: data?.stale ?? false,
    loading: poll.loading,
    error: poll.error,
    lastUpdated: poll.lastUpdated,
    refresh: poll.refresh,
  };
}

export default useFxRates;
