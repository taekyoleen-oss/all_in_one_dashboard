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

/**
 * 직전 거래일 종가 — 해당 국가(미국·한국) 시장의 "전일 종가"를 일봉 시계열에서 직접 구한다.
 * Naver/Google이 보여주는 "전일대비"의 기준값과 동일하며, 한국 시각·요일 경계와 무관하게
 * 그 종목 자국 시장의 직전 세션 종가를 쓴다.
 *
 * Yahoo가 `meta.previousClose`를 빠뜨리는 경우(현재 지수 응답이 그렇다)를 대비한 권위 소스다.
 * `meta.chartPreviousClose`는 range 윈도우(5d) *시작 직전* 봉, 즉 약 5거래일 전 종가라서
 * 전일종가로 쓰면 등락의 폭·부호가 모두 틀어진다(다우는 부호까지 반전됨) — 그래서 쓰지 않는다.
 *
 *  - 정규장 진행 중: 마지막 봉이 오늘(진행 중) 세션 → 전일종가는 그 직전 봉.
 *  - 장 마감/시간외: 마지막 봉이 가장 최근 완료 세션 → 전일종가는 역시 직전 봉.
 *  - 새 세션이 시작됐는데 아직 봉이 안 생긴 드문 경우(latestTs가 마지막 봉보다 20h+ 이후):
 *    마지막 봉 자체가 전일종가.
 *
 * 두 세션 이상을 못 구하면 null.
 */
function previousDailyClose(
  timestamps: number[],
  closes: Array<number | null>,
  latestTs: number,
): number | null {
  const bars: Array<{ ts: number; close: number }> = [];
  for (let i = 0; i < closes.length; i++) {
    const c = closes[i];
    if (typeof c === "number" && Number.isFinite(c)) {
      bars.push({ ts: timestamps[i] ?? 0, close: c });
    }
  }
  if (bars.length === 0) return null;
  const last = bars[bars.length - 1];
  // 일봉 ts는 세션 시작 시각으로 찍힌다. 같은 세션의 실시간 시세는 ~14h 이내에 위치하므로,
  // latestTs가 마지막 봉보다 20h 넘게 뒤면 봉이 아직 안 생긴 새 세션 → 마지막 봉이 전일종가.
  if (latestTs - last.ts > 20 * 3600) return last.close;
  // 일반: 마지막 봉이 최신 세션 → 전일종가는 그 직전 봉.
  return bars.length >= 2 ? bars[bars.length - 2].close : last.close;
}

/** Fetch + normalize a single symbol; returns null on any failure (caller tracks errors). */
async function fetchOne(symbol: StockSymbol): Promise<StockQuote | null> {
  const meta = resolveMeta(symbol);
  const yahoo = toYahooSymbol(symbol);
  // range=5d (not 1d): 일봉 시계열에서 직전 거래일 종가를 직접 뽑아 등락 기준으로 쓰기 위해
  // 최소 두 세션이 필요하다(1d면 한 세션뿐). 이 일봉이 정규가 + 전일종가(지수 포함)의 권위 소스다.
  const base = await fetchChart(yahoo, "1d", "5d");
  const m = base?.meta;
  if (!m || typeof m.regularMarketPrice !== "number") return null;

  let price = m.regularMarketPrice;
  let tsSec =
    typeof m.regularMarketTime === "number" ? m.regularMarketTime : Date.now() / 1000;

  // 전일종가(해당 국가 시장 직전 세션 종가) 우선순위:
  //  1) meta.previousClose — 있으면 권위값(현재 지수 응답엔 대개 없음).
  //  2) 일봉 시계열의 직전 세션 종가 — 화면에 보이는 "전일대비"와 동일한 기준.
  //  3) chartPreviousClose — 마지막 폴백(주의: 5거래일 전 값이라 부정확할 수 있음).
  const prevClose =
    typeof m.previousClose === "number"
      ? m.previousClose
      : (base
          ? previousDailyClose(base.timestamps, base.closes, tsSec)
          : null) ??
        (typeof m.chartPreviousClose === "number"
          ? m.chartPreviousClose
          : m.regularMarketPrice);

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
