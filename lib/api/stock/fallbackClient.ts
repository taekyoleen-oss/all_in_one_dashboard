/**
 * ============================================================================
 *  Fallback stock provider — keyless, WORKS TODAY (설계서 §6.5 fallback)
 * ============================================================================
 *
 *  SERVER-ONLY. No API key required. Uses Yahoo Finance's public chart endpoint
 *  (query1.finance.yahoo.com/v8/finance/chart/{symbol}) which returns the last
 *  price + previous close in `meta`. We poll server-side (~12s) to approximate
 *  real-time; `subscribe` is a polling loop that emits an onTick per changed
 *  quote. Marked `stale: true` so the widget shows a "근사치" badge.
 *
 *  This is the default provider whenever KIS is not configured, so the stock
 *  widget renders index data on day one with zero setup.
 *
 *  Read-only market data for personal use (재배포 금지) — quotes only.
 * ============================================================================
 */

// SERVER-ONLY: loaded via dynamic import from provider.ts (never client-bundled).
import type { StockQuote, StockSymbol } from "@/output/api-shapes";
import type { OnTick, StockQuoteProvider, Unsubscribe } from "./provider";
import { resolveMeta, toYahooSymbol } from "./symbols";

/** Poll cadence for the streaming subscription (~12s ≈ near-real-time, gentle). */
const POLL_MS = 12_000;
/** Per-request timeout so a slow upstream can't wedge the SSE loop. */
const FETCH_TIMEOUT_MS = 8_000;

const YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";

/** Minimal shape we read out of Yahoo's chart response `meta`. */
interface YahooChartMeta {
  regularMarketPrice?: number;
  previousClose?: number;
  chartPreviousClose?: number;
  currency?: string;
  regularMarketTime?: number; // epoch seconds
}

/** Fetch + normalize a single symbol; returns null on any failure (caller tracks errors). */
async function fetchOne(symbol: StockSymbol): Promise<StockQuote | null> {
  const meta = resolveMeta(symbol);
  const yahoo = toYahooSymbol(symbol);
  const url = `${YAHOO_BASE}/${encodeURIComponent(yahoo)}?interval=1d&range=1d`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      // Yahoo blocks the default Node UA intermittently; a browser-like UA is friendlier.
      headers: { "User-Agent": "Mozilla/5.0 (PaneBoard quote fallback)" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      chart?: { result?: Array<{ meta?: YahooChartMeta }> | null; error?: unknown };
    };
    const m = json.chart?.result?.[0]?.meta;
    if (!m || typeof m.regularMarketPrice !== "number") return null;

    const price = m.regularMarketPrice;
    const prevClose =
      typeof m.previousClose === "number"
        ? m.previousClose
        : typeof m.chartPreviousClose === "number"
          ? m.chartPreviousClose
          : price;
    const change = round2(price - prevClose);
    const changePct = prevClose !== 0 ? round2(((price - prevClose) / prevClose) * 100) : 0;
    const ts =
      typeof m.regularMarketTime === "number" ? m.regularMarketTime * 1000 : Date.now();

    return {
      symbol,
      name: meta.name,
      price: round2(price),
      change,
      changePct,
      ts,
      currency: m.currency ?? meta.currency,
      isIndex: meta.isIndex,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function getQuotesImpl(
  symbols: StockSymbol[],
): Promise<{ quotes: StockQuote[]; errors: StockSymbol[] }> {
  const settled = await Promise.all(
    symbols.map(async (s) => ({ s, q: await fetchOne(s) })),
  );
  const quotes: StockQuote[] = [];
  const errors: StockSymbol[] = [];
  for (const { s, q } of settled) {
    if (q) quotes.push(q);
    else errors.push(s);
  }
  return { quotes, errors };
}

/**
 * Polling subscription: emits an initial snapshot immediately, then re-polls
 * every POLL_MS and emits onTick only for quotes whose price/change moved
 * (reduces redundant SSE frames). Returns a cleanup that stops the loop.
 */
function subscribeImpl(symbols: StockSymbol[], onTick: OnTick): Unsubscribe {
  let stopped = false;
  const last = new Map<string, number>(); // symbol → last emitted price

  const tick = async () => {
    if (stopped) return;
    const { quotes } = await getQuotesImpl(symbols);
    if (stopped) return;
    for (const q of quotes) {
      const prev = last.get(q.symbol);
      if (prev === undefined || prev !== q.price) {
        last.set(q.symbol, q.price);
        onTick(q);
      }
    }
  };

  // Emit the seed immediately, then on a fixed cadence.
  void tick();
  const id = setInterval(() => void tick(), POLL_MS);

  return () => {
    stopped = true;
    clearInterval(id);
  };
}

/** Construct the fallback provider (no credentials, always available). */
export function createFallbackProvider(): StockQuoteProvider {
  return {
    id: "fallback",
    stale: true,
    getQuotes: getQuotesImpl,
    subscribe: subscribeImpl,
  };
}
