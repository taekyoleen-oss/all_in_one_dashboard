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

/** A normalized slice of one Yahoo chart response (meta + the close time series). */
interface ChartResult {
  meta: YahooChartMeta;
  /** epoch seconds, aligned with `closes`. */
  timestamps: number[];
  /** regular (+ pre/post when includePrePost) close per bar; may contain nulls. */
  closes: Array<number | null>;
}

/** One Yahoo chart fetch (range/interval configurable); null on any failure. */
async function fetchChart(
  yahoo: string,
  interval: string,
  range: string,
  prePost = false,
): Promise<ChartResult | null> {
  const url =
    `${YAHOO_BASE}/${encodeURIComponent(yahoo)}?interval=${interval}&range=${range}` +
    (prePost ? "&includePrePost=true" : "");
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
      chart?: {
        result?: Array<{
          meta?: YahooChartMeta;
          timestamp?: number[];
          indicators?: { quote?: Array<{ close?: Array<number | null> }> };
        }> | null;
        error?: unknown;
      };
    };
    const r = json.chart?.result?.[0];
    if (!r?.meta) return null;
    return {
      meta: r.meta,
      timestamps: r.timestamp ?? [],
      closes: r.indicators?.quote?.[0]?.close ?? [],
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** The last finite close in the series (+ its epoch-seconds ts), or null. */
function lastFiniteClose(
  timestamps: number[],
  closes: Array<number | null>,
): { price: number; ts: number } | null {
  for (let i = closes.length - 1; i >= 0; i--) {
    const c = closes[i];
    if (typeof c === "number" && Number.isFinite(c)) {
      return { price: c, ts: timestamps[i] ?? 0 };
    }
  }
  return null;
}

/** Fetch + normalize a single symbol; returns null on any failure (caller tracks errors). */
async function fetchOne(symbol: StockSymbol): Promise<StockQuote | null> {
  const meta = resolveMeta(symbol);
  const yahoo = toYahooSymbol(symbol);
  // range=5d (not 1d): with 1d Yahoo often omits `previousClose`, making the
  // day change read 0. 5d reliably carries previousClose for a correct 등락. This
  // is the authoritative base for the regular price + 전일종가 (indices included).
  const base = await fetchChart(yahoo, "1d", "5d");
  const m = base?.meta;
  if (!m || typeof m.regularMarketPrice !== "number") return null;

  const prevClose =
    typeof m.previousClose === "number"
      ? m.previousClose
      : typeof m.chartPreviousClose === "number"
        ? m.chartPreviousClose
        : m.regularMarketPrice;

  let price = m.regularMarketPrice;
  let tsSec =
    typeof m.regularMarketTime === "number" ? m.regularMarketTime : Date.now() / 1000;

  // 시간외(pre/post market) 반영: 정규장 마감 후 움직인 가격을 보여준다. 지수(^…)는
  // 시간외 거래가 없고 분봉 series가 비어 있으므로 건너뛴다(정규장 종가 = 최종값).
  // includePrePost 분봉의 마지막 체결 close가 정규장 시각 이후면 그 값으로 갱신 →
  // 등락은 전일종가 대비로 계산되어 시간외 상승/하락이 자연히 반영된다.
  if (!meta.isIndex) {
    const ext = await fetchChart(yahoo, "2m", "1d", true);
    if (ext) {
      const last = lastFiniteClose(ext.timestamps, ext.closes);
      if (last && last.ts > tsSec) {
        price = last.price;
        tsSec = last.ts;
      }
    }
  }

  const change = round2(price - prevClose);
  const changePct = prevClose !== 0 ? round2(((price - prevClose) / prevClose) * 100) : 0;

  return {
    symbol,
    name: meta.name,
    price: round2(price),
    change,
    changePct,
    ts: Math.round(tsSec * 1000),
    currency: m.currency ?? meta.currency,
    isIndex: meta.isIndex,
  };
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
 * Keyless Yahoo quotes for a symbol subset — exported so the KIS provider can
 * delegate symbols it doesn't cover (해외 지수: 다우·S&P·나스닥) to this fallback,
 * since KIS's domestic surface has no overseas-index quote. Server-only.
 */
export async function fetchFallbackQuotes(
  symbols: StockSymbol[],
): Promise<{ quotes: StockQuote[]; errors: StockSymbol[] }> {
  return getQuotesImpl(symbols);
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
