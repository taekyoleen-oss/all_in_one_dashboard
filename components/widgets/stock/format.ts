/**
 * stock widget — display formatting + direction helpers (설계서 §2.1).
 *
 *  Direction is conveyed by BOTH color AND a symbol (▲ 상승 / ▼ 하락 / — 보합),
 *  so color is never the only signal (접근성). Colors use the --positive (red,
 *  KR 상승) / --negative (blue, KR 하락) tokens via Tailwind text-positive /
 *  text-negative utilities.
 */

import type { StockQuote } from "@/output/api-shapes";

export type Direction = "up" | "down" | "flat";

export function directionOf(q: Pick<StockQuote, "change">): Direction {
  if (q.change > 0) return "up";
  if (q.change < 0) return "down";
  return "flat";
}

/** Tailwind text-color class for a direction (token-driven, locale-aware via data-updown). */
export function directionColorClass(dir: Direction): string {
  if (dir === "up") return "text-positive";
  if (dir === "down") return "text-negative";
  return "text-muted-foreground";
}

/** The leading arrow/marker glyph for a direction (non-color signal). */
export function directionArrow(dir: Direction): string {
  if (dir === "up") return "▲";
  if (dir === "down") return "▼";
  return "—";
}

/** Format a price with sensible precision (indices/large numbers get thousands). */
export function formatPrice(value: number, currency?: string): string {
  const abs = Math.abs(value);
  const maxFrac = abs >= 1000 ? 2 : abs >= 1 ? 2 : 4;
  const n = value.toLocaleString(undefined, {
    minimumFractionDigits: abs >= 1000 ? 0 : 0,
    maximumFractionDigits: maxFrac,
  });
  return currency === "USD" ? `$${n}` : n;
}

/** Signed change, e.g. "+1,234.5" / "-12.30" / "0". */
export function formatChange(value: number): string {
  if (value === 0) return "0";
  const sign = value > 0 ? "+" : "-";
  const n = Math.abs(value).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${sign}${n}`;
}

/** Signed percent, e.g. "+1.23%" / "-0.42%". */
export function formatPct(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${Math.abs(value).toFixed(2)}%`;
}

/**
 * "결과 시각" label for the last update — local wall-clock time (오후 3:24:10).
 * Returns "—" when there's no result yet. Seconds are shown so a manual refresh
 * is visibly reflected even within the same minute.
 */
export function formatUpdatedTime(ts: number | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
