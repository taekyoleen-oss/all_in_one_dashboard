/**
 * Parse + sanitize the `?symbols=` query param shared by the snapshot and stream
 * routes. Comma-separated, trimmed, de-duplicated, length-bounded, and capped so
 * a single request can't ask for an unbounded number of subscriptions.
 *
 *  No "server-only" marker: this is a pure string utility safe in any context,
 *  but it lives under lib/api/stock for cohesion with the routes that use it.
 */

import { StockSymbolSchema, type StockSymbol } from "@/output/api-shapes";

/** Max symbols honored per request (defensive cap on fan-out). */
export const MAX_SYMBOLS = 30;

export function parseSymbolsParam(raw: string | null): StockSymbol[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: StockSymbol[] = [];
  for (const part of raw.split(",")) {
    const s = part.trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    if (!StockSymbolSchema.safeParse(s).success) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= MAX_SYMBOLS) break;
  }
  return out;
}
