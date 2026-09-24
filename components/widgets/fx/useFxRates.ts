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

import { FxRatesSchema, type FxRates } from "@/output/api-shapes";
import { usePoll } from "@/components/widgets/shared/usePoll";
import { fxDirectionFromPct, type FxDirection } from "./format";
import { fxRows } from "./rows";
import { foreignCurrencies, type FxConfig } from "./types";

/** Poll cadence for FX. 네이버 고시환율은 장중 수시 갱신되므로 3분 주기면 충분하다. */
export const FX_REFRESH_MS = 180_000;

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

  // 원화 환산·전일대비는 폰 브리지(/api/widget/fx)와 **같은 함수**로 계산한다
  // (두 곳에서 따로 뒤집으면 웹·폰 숫자가 갈라진다 — rows.ts 머리말).
  const rows: FxRow[] = data
    ? fxRows(foreign, data.rates, data.changePct).map((r) => ({
        quote: r.code,
        unit: r.unit,
        krw: r.krw,
        direction: fxDirectionFromPct(r.changePct),
        changePct: r.changePct,
        changeAbs: r.changeAbs,
      }))
    : [];

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
