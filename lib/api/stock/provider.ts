/**
 * ============================================================================
 *  StockQuoteProvider — the provider abstraction (설계서 §6.5)
 * ============================================================================
 *
 *  SERVER-ONLY. A provider turns provider-neutral symbols into normalized
 *  `StockQuote`s (from output/api-shapes.ts — the anti-drift single source) two
 *  ways:
 *    • getQuotes(symbols)         → one snapshot batch (used by GET /api/stocks
 *      and as the SSE seed).
 *    • subscribe(symbols, onTick) → a live stream; calls onTick(quote) per update
 *      and returns an unsubscribe/cleanup function.
 *
 *  `getProvider()` chooses KIS only when STOCK_PROVIDER==='kis' AND the KIS_*
 *  credentials are actually present; otherwise it returns the keyless fallback so
 *  the widget shows index data TODAY with no API key. Credentials live exclusively
 *  inside the KIS provider module and never cross this boundary.
 *
 *  READ-ONLY: providers expose quotes only. No order/balance/account surface
 *  exists anywhere in this tree (불변 가드레일).
 * ============================================================================
 */

// SERVER-ONLY by construction: only imported from route handlers and the
// dynamic-imported provider modules below. (The `server-only` npm guard package
// is not installed in this project; existing server modules rely on the same
// import-site discipline — see lib/supabase/server.ts.)
import type { StockQuote, StockSymbol } from "@/output/api-shapes";

/** A callback the provider invokes for each live quote update. */
export type OnTick = (quote: StockQuote) => void;

/** Cleanup handle returned by `subscribe` — idempotent; closes sockets/timers. */
export type Unsubscribe = () => void;

export interface StockQuoteProvider {
  /** Stable id for badges/logging: "kis" (live) or "fallback" (keyless poller). */
  readonly id: "kis" | "fallback";
  /** True when this provider serves approximate/polled data (→ stale badge). */
  readonly stale: boolean;

  /**
   * Resolve a one-shot snapshot for `symbols`. Unresolvable symbols are omitted
   * from `quotes` and listed in `errors` (the whole batch never rejects for one
   * bad ticker).
   */
  getQuotes(
    symbols: StockSymbol[],
  ): Promise<{ quotes: StockQuote[]; errors: StockSymbol[] }>;

  /**
   * Begin a live subscription for `symbols`. `onTick` fires per update. Returns
   * a cleanup function that MUST be called on client disconnect (the SSE route
   * wires it to request abort).
   */
  subscribe(symbols: StockSymbol[], onTick: OnTick): Unsubscribe;
}

/** True iff every KIS credential the live provider needs is present + non-empty. */
export function hasKisCredentials(): boolean {
  const key = process.env.KIS_APP_KEY?.trim();
  const secret = process.env.KIS_APP_SECRET?.trim();
  // HTS id is required by KIS for some realtime flows; treat it as required for
  // the "kis" path so we degrade to fallback rather than half-configure.
  const hts = process.env.KIS_HTS_ID?.trim();
  return Boolean(key && secret && hts);
}

/**
 * Whether the KIS live provider should be used. Requires the explicit opt-in
 * (STOCK_PROVIDER==='kis') AND real credentials. Absent either, we fall back so
 * the widget still shows index data.
 */
export function shouldUseKis(): boolean {
  return process.env.STOCK_PROVIDER?.trim().toLowerCase() === "kis" &&
    hasKisCredentials();
}

/**
 * Factory: pick the provider for this runtime. Cached per-process so the KIS
 * token cache / fallback poll cache are shared across requests.
 *
 *  Dynamic imports keep the KIS module (and its credential reads) out of any
 *  bundle that only needs the fallback, and avoid evaluating KIS code paths when
 *  unconfigured.
 */
let cached: StockQuoteProvider | null = null;
let cachedKey = "";

export async function getProvider(): Promise<StockQuoteProvider> {
  const key = shouldUseKis() ? "kis" : "fallback";
  if (cached && cachedKey === key) return cached;

  if (key === "kis") {
    const { createKisProvider } = await import("./kisClient");
    cached = createKisProvider();
  } else {
    const { createFallbackProvider } = await import("./fallbackClient");
    cached = createFallbackProvider();
  }
  cachedKey = key;
  return cached;
}
