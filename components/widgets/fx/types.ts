/**
 * fx widget — config shape (설계서 §2.2 "환율").
 *
 *  The widget stores a base currency + a list of quote currencies to display as
 *  pairs (base→quote). Rate DATA never lives in config — only the selection
 *  does; live values arrive from /api/fx. dataMode:'poll'.
 *
 *  Default = USD base with KRW·EUR·JPY·CNY quotes (a sensible global+KR mix).
 */

export interface FxConfig {
  /** ISO-4217 base currency every pair is quoted against (e.g. "USD"). */
  base: string;
  /** ISO-4217 quote currencies, in display order (e.g. ["KRW","EUR"]). */
  quotes: string[];
}

// KRW-oriented by default: show how many 원 per 1 USD / 100 JPY / 1 EUR / 1 CNY
// (한국에서 보통 보는 방식). The widget treats KRW as the reference and lists the
// other currencies; base is kept for backward-compat but display is always 원 기준.
export const DEFAULT_FX_CONFIG: FxConfig = {
  base: "KRW",
  quotes: ["USD", "JPY", "EUR", "CNY"],
};

/** Conventional quote unit per currency (KR shows 엔 per 100; others per 1). */
export function fxUnit(code: string): number {
  return code === "JPY" ? 100 : 1;
}

/**
 * The foreign currencies to show in KRW terms, derived from any config (so old
 * USD-based configs still work): everything in base+quotes except KRW itself.
 */
export function foreignCurrencies(config: FxConfig): string[] {
  const seen = new Set<string>();
  for (const c of [config.base, ...config.quotes]) {
    const code = (c ?? "").trim().toUpperCase();
    if (code && code !== "KRW") seen.add(code);
  }
  return [...seen];
}

/** A small palette of common currencies for the picker (free-text also allowed). */
export const COMMON_CURRENCIES: { code: string; label: string }[] = [
  { code: "USD", label: "미국 달러" },
  { code: "KRW", label: "대한민국 원" },
  { code: "EUR", label: "유로" },
  { code: "JPY", label: "일본 엔" },
  { code: "CNY", label: "중국 위안" },
  { code: "GBP", label: "영국 파운드" },
  { code: "AUD", label: "호주 달러" },
  { code: "CAD", label: "캐나다 달러" },
  { code: "CHF", label: "스위스 프랑" },
  { code: "HKD", label: "홍콩 달러" },
  { code: "SGD", label: "싱가포르 달러" },
];
