/**
 * fx widget — formatting + direction helpers (설계서 §2.2).
 *
 *  Direction (a pair's rate vs. the previous poll) is conveyed by BOTH color AND
 *  a ▲/▼/— marker, so color is never the only signal (접근성). Up uses
 *  --positive, down uses --negative (the same tokens as the stock widget).
 */

export type FxDirection = "up" | "down" | "flat";

export function fxDirection(current: number, prev: number | undefined): FxDirection {
  if (prev === undefined || current === prev) return "flat";
  return current > prev ? "up" : "down";
}

export function fxDirectionColorClass(dir: FxDirection): string {
  if (dir === "up") return "text-positive";
  if (dir === "down") return "text-negative";
  return "text-muted-foreground";
}

export function fxDirectionArrow(dir: FxDirection): string {
  if (dir === "up") return "▲";
  if (dir === "down") return "▼";
  return "—";
}

/**
 * Format a rate with precision that scales to magnitude: tiny rates (e.g. 1
 * KRW→USD) need more decimals; large ones (1 USD→KRW ≈ 1378) fewer.
 */
export function formatRate(value: number): string {
  const abs = Math.abs(value);
  const maxFrac = abs >= 100 ? 2 : abs >= 1 ? 4 : 6;
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: maxFrac,
  });
}

/** "1 USD = 1,378.20 KRW" style pair label. */
export function pairLabel(base: string, quote: string, rate: number): string {
  return `1 ${base} = ${formatRate(rate)} ${quote}`;
}

/** Direction from a signed day-over-day percent. */
export function fxDirectionFromPct(pct: number | undefined): FxDirection {
  if (pct === undefined || pct === 0) return "flat";
  return pct > 0 ? "up" : "down";
}

/** "+0.42%" / "-1.20%" 전일 대비 percent (null when unknown). */
export function formatFxPct(pct: number | undefined): string | null {
  if (typeof pct !== "number" || !Number.isFinite(pct)) return null;
  const sign = pct > 0 ? "+" : pct < 0 ? "-" : "";
  return `${sign}${Math.abs(pct).toFixed(2)}%`;
}

/**
 * "+5.30원" / "-12.00원" — 전일 대비 KRW 금액 변동 (null when unknown). Decimals
 * scale to magnitude so small moves still read precisely (큰 값은 2자리로 충분).
 */
export function formatFxAmount(amount: number | undefined): string | null {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return null;
  const sign = amount > 0 ? "+" : amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  const maxFrac = abs >= 100 ? 1 : 2;
  return `${sign}${abs.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: maxFrac,
  })}원`;
}
