/**
 * ============================================================================
 *  Stock symbol catalog — provider-neutral ticker metadata (설계서 §2.1)
 * ============================================================================
 *
 *  Maps the provider-neutral symbols stored in widget config to display names,
 *  index-vs-stock classification, and currency. Both providers (KIS + fallback)
 *  read this so a name like "코스피" is consistent regardless of source.
 *
 *  Symbol convention (what the widget stores in config):
 *    • KR indices   : "^KS11" (코스피), "^KQ11" (코스닥)
 *    • US indices   : "^DJI" (다우), "^GSPC" (S&P 500), "^IXIC" (나스닥)
 *    • KR stocks    : 6-digit code, optionally ".KS"/".KQ" suffix ("005930" / "005930.KS")
 *  US individual stocks are intentionally NOT offered (미국은 지수만 — spec).
 * ============================================================================
 */

import type { StockSymbol } from "@/output/api-shapes";

export interface SymbolMeta {
  /** Provider-neutral symbol (catalog key). */
  symbol: StockSymbol;
  /** Default Korean display name. */
  name: string;
  /** Index vs individual stock. */
  isIndex: boolean;
  /** ISO-4217 currency of the quote. */
  currency: "KRW" | "USD";
}

/** Curated indices — the default config uses 코스피·코스닥 + 다우·S&P·나스닥. */
export const INDEX_CATALOG: SymbolMeta[] = [
  { symbol: "^KS11", name: "코스피", isIndex: true, currency: "KRW" },
  { symbol: "^KQ11", name: "코스닥", isIndex: true, currency: "KRW" },
  { symbol: "^DJI", name: "다우", isIndex: true, currency: "USD" },
  { symbol: "^GSPC", name: "S&P 500", isIndex: true, currency: "USD" },
  { symbol: "^IXIC", name: "나스닥", isIndex: true, currency: "USD" },
];

/** A few well-known KR stocks for the picker's quick-add list (free-text also allowed). */
export const KR_STOCK_SUGGESTIONS: SymbolMeta[] = [
  { symbol: "005930", name: "삼성전자", isIndex: false, currency: "KRW" },
  { symbol: "000660", name: "SK하이닉스", isIndex: false, currency: "KRW" },
  { symbol: "035420", name: "NAVER", isIndex: false, currency: "KRW" },
  { symbol: "035720", name: "카카오", isIndex: false, currency: "KRW" },
  { symbol: "005380", name: "현대차", isIndex: false, currency: "KRW" },
  { symbol: "051910", name: "LG화학", isIndex: false, currency: "KRW" },
  { symbol: "005490", name: "POSCO홀딩스", isIndex: false, currency: "KRW" },
  { symbol: "068270", name: "셀트리온", isIndex: false, currency: "KRW" },
];

const BY_SYMBOL = new Map<string, SymbolMeta>(
  [...INDEX_CATALOG, ...KR_STOCK_SUGGESTIONS].map((m) => [m.symbol, m]),
);

/** Strip a ".KS"/".KQ" suffix and return the bare 6-digit code (else null). */
export function krCode(symbol: string): string | null {
  const m = symbol.match(/^(\d{6})(?:\.[A-Za-z]{2})?$/);
  return m ? m[1] : null;
}

/** True for a KR index symbol ("^KS11"/"^KQ11"). */
export function isKrIndex(symbol: string): boolean {
  return symbol === "^KS11" || symbol === "^KQ11";
}

/** True for a US index symbol ("^DJI"/"^GSPC"/"^IXIC"). */
export function isUsIndex(symbol: string): boolean {
  return symbol === "^DJI" || symbol === "^GSPC" || symbol === "^IXIC";
}

/** True for any caret-prefixed index symbol. */
export function isIndexSymbol(symbol: string): boolean {
  return symbol.startsWith("^");
}

/**
 * Best-effort metadata for a symbol: the curated entry when known, otherwise a
 * reasonable default (KR 6-digit ⇒ KRW stock; caret ⇒ index; else KRW stock).
 * The `name` falls back to the symbol so the UI always has a label.
 */
export function resolveMeta(symbol: string): SymbolMeta {
  const hit = BY_SYMBOL.get(symbol);
  if (hit) return hit;

  if (isIndexSymbol(symbol)) {
    return {
      symbol,
      name: symbol.replace(/^\^/, ""),
      isIndex: true,
      currency: isUsIndex(symbol) ? "USD" : "KRW",
    };
  }
  const code = krCode(symbol);
  if (code) {
    return { symbol, name: code, isIndex: false, currency: "KRW" };
  }
  // Unknown free-form symbol — assume a KR stock so quotes still attempt to resolve.
  return { symbol, name: symbol, isIndex: false, currency: "KRW" };
}

/**
 * The Yahoo Finance chart symbol for a provider-neutral symbol.
 *  - indices map 1:1 (Yahoo uses the same caret symbols).
 *  - a bare 6-digit KR code needs an exchange suffix; default ".KS" (KOSPI). A
 *    KOSDAQ name may be entered explicitly as "035720.KQ".
 */
export function toYahooSymbol(symbol: string): string {
  if (isIndexSymbol(symbol)) return symbol;
  const code = krCode(symbol);
  if (code) {
    // Preserve an explicit .KQ; otherwise default to .KS.
    return symbol.includes(".") ? symbol : `${code}.KS`;
  }
  return symbol;
}
