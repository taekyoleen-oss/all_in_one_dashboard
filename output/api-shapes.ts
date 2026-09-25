/**
 * ============================================================================
 *  PaneBoard API shapes — the ANTI-DRIFT single source (설계서 §6.5, §9.7)
 * ============================================================================
 *
 *  AUTHOR: api-designer. Every `/api/*` response (and SSE event) is published
 *  here as a **Zod schema + inferred type**. This is the ONE place the runtime
 *  shape of a server response is declared, and the ONLY place widget-engineer
 *  imports server payload types from. Re-declaring an API shape inside a widget
 *  (snake/camel drift, wrapper drift, missing fields) is FORBIDDEN — import from
 *  here instead. When a shape changes, edit it here and notify widget-engineer.
 *
 *  Validation discipline:
 *    • The server parses external/provider data into these shapes (so a provider
 *      field rename can't silently leak through).
 *    • The client may `safeParse` SSE frames defensively (a malformed frame is
 *      dropped, never crashes the widget).
 *
 *  ── Phase-3 chunk map ──────────────────────────────────────────────────────
 *  THIS CHUNK (stock vertical slice):  StockQuote · StockSnapshot · StockStreamEvent.
 *  LATER CHUNKS append here (do NOT fork this file):
 *    • fx       → FxRate / FxSnapshot              (dataMode 'poll')
 *    • weather  → WeatherNow / WeatherSnapshot     (dataMode 'poll')
 *    • news     → NewsItem / NewsFeed              (dataMode 'poll')
 *    • calendar → CalendarEvent / CalendarFeed     (dataMode 'poll', Google scope)
 *    • card     → CardTxn / CardSummary            (read-only snapshot, sensitive)
 *  Keep additions grouped by domain with a banner comment, mirroring the stock
 *  block below.
 * ============================================================================
 */

import { z } from "zod";

/* ===========================================================================
 *  STOCK  (dataMode: 'stream' — SSE; fallback poll for the snapshot)
 * ===========================================================================
 *
 *  Quotes are READ-ONLY market data for personal use (설계서 §6.5 — KIS는 읽기
 *  전용 시세만; 주문/잔고 금지). The same `StockQuote` shape is emitted by every
 *  provider (KIS live / Yahoo fallback) AND carried in each SSE tick, so the
 *  widget renders one normalized shape regardless of source.
 *
 *  Numbers are already normalized by the server:
 *    • `change`    is SIGNED (+up / −down) — providers that return an unsigned
 *      magnitude + a separate sign (e.g. KIS prdy_vrss + prdy_vrss_sign) are
 *      reconciled server-side before they reach this shape.
 *    • `changePct` is a SIGNED percent number (e.g. 1.23 means +1.23%, not 0.0123).
 *    • `price`/`change` are in the instrument's own `currency` (KRW for KR, USD
 *      for US indices). The widget shows direction by color AND the ▲/▼ symbol.
 */

/** Symbols the server understands. A provider-neutral ticker (e.g. "^KS11",
 *  "005930", "^DJI"). The widget config stores these verbatim. */
export const StockSymbolSchema = z.string().min(1).max(24);
export type StockSymbol = z.infer<typeof StockSymbolSchema>;

/**
 * One normalized quote. The shared shape across providers and across the
 * snapshot (`/api/stocks`) and stream (`/api/stocks/stream`) surfaces.
 */
export const StockQuoteSchema = z.object({
  /** Provider-neutral ticker exactly as requested (e.g. "^KS11", "005930.KS"). */
  symbol: StockSymbolSchema,
  /** Human-readable display name ("코스피", "삼성전자", "S&P 500"). */
  name: z.string(),
  /** Last/current price in `currency`. */
  price: z.number(),
  /** SIGNED change vs. previous close (+up / −down), same units as `price`. */
  change: z.number(),
  /** SIGNED percent change (e.g. -0.42 == −0.42%). */
  changePct: z.number(),
  /** Quote timestamp — epoch milliseconds (server clock / provider time). */
  ts: z.number().int(),
  /** ISO-4217 currency of `price`/`change`. Optional; defaults to KRW client-side. */
  currency: z.string().optional(),
  /** True for an index (코스피/다우/…) vs. an individual stock. Drives UI affordances. */
  isIndex: z.boolean().optional(),
  /**
   * 정규장 **밖의** 체결로 만들어진 시세일 때만 붙는 표식(요구: "pre 등을 표시").
   *  - "pre"  : 정규장 개장 **전** 체결(미국 프리마켓).
   *  - "post" : 정규장 마감 **후** 체결 — 미국 애프터마켓, 국내 시간외 단일가.
   * 없으면 정규장 시세다. price·change·changePct는 표식과 무관하게 항상
   * **전일 종가 대비**라 시간외 등락이 그대로 반영된다.
   */
  session: z.enum(["pre", "post"]).optional(),
});
export type StockQuote = z.infer<typeof StockQuoteSchema>;

/**
 * Snapshot response of `GET /api/stocks?symbols=a,b,c`.
 *  - `quotes`  : resolved quotes (order not guaranteed — match by `symbol`).
 *  - `errors`  : symbols that could not be resolved (kept so the widget can show
 *                a per-row "—" without failing the whole tile).
 *  - `provider`: which provider served this batch (for a stale/source badge).
 *  - `stale`   : true when served from the keyless fallback (approximate, polled).
 */
export const StockSnapshotSchema = z.object({
  quotes: z.array(StockQuoteSchema),
  errors: z.array(StockSymbolSchema).default([]),
  provider: z.enum(["kis", "fallback"]),
  stale: z.boolean(),
  /** When the server assembled this snapshot (epoch ms). */
  ts: z.number().int(),
});
export type StockSnapshot = z.infer<typeof StockSnapshotSchema>;

/**
 * SSE event payload pushed over `GET /api/stocks/stream?symbols=…`.
 *
 *  Wire framing (text/event-stream): each message is
 *      event: <type>\n
 *      data: <JSON of the matching member below>\n\n
 *
 *  Members (discriminated by `type`):
 *   • "hello"     — once on connect: which provider + whether stale (fallback).
 *   • "quote"     — a single updated quote (one per tick).
 *   • "heartbeat" — periodic keep-alive (no payload beyond ts) so proxies don't
 *                   cut an idle connection and the client can detect staleness.
 *
 *  NOTE: this carries QUOTES ONLY. Credentials (approval_key/appkey/appsecret)
 *  are NEVER serialized into any SSE frame.
 */
export const StockStreamHelloSchema = z.object({
  type: z.literal("hello"),
  provider: z.enum(["kis", "fallback"]),
  stale: z.boolean(),
  ts: z.number().int(),
});
export type StockStreamHello = z.infer<typeof StockStreamHelloSchema>;

export const StockStreamQuoteSchema = z.object({
  type: z.literal("quote"),
  quote: StockQuoteSchema,
});
export type StockStreamQuote = z.infer<typeof StockStreamQuoteSchema>;

export const StockStreamHeartbeatSchema = z.object({
  type: z.literal("heartbeat"),
  ts: z.number().int(),
});
export type StockStreamHeartbeat = z.infer<typeof StockStreamHeartbeatSchema>;

/** The full discriminated union of SSE events. */
export const StockStreamEventSchema = z.discriminatedUnion("type", [
  StockStreamHelloSchema,
  StockStreamQuoteSchema,
  StockStreamHeartbeatSchema,
]);
export type StockStreamEvent = z.infer<typeof StockStreamEventSchema>;

/** SSE `event:` names that may appear on the wire (mirrors the union `type`s). */
export const STOCK_STREAM_EVENTS = ["hello", "quote", "heartbeat"] as const;
export type StockStreamEventName = (typeof STOCK_STREAM_EVENTS)[number];

/**
 * `GET /api/stocks/search?q=…` — 미국 종목·ETF 이름 검색 결과.
 *
 *  국내 종목은 클라이언트 번들의 KRX 카탈로그로 즉시 검색되지만(오프라인), 미국은
 *  카탈로그가 없어 서버가 Yahoo 검색을 대신 호출한다. 시세가 아니라 '심볼 찾기'용.
 */
export const StockSearchResultSchema = z.object({
  /** 위젯 config에 저장될 provider-neutral 심볼 (예: "AAPL", "SPY"). */
  symbol: StockSymbolSchema,
  /** 표시 이름 ("Apple Inc.", "Schwab US Dividend Equity ETF"). */
  name: z.string(),
  /** 상장 거래소 코드 (예: "NMS", "PCX") — 동명이종 구분용. */
  exchange: z.string().default(""),
  /** 종목 종류 — 개별 주식 vs ETF. */
  type: z.enum(["EQUITY", "ETF"]),
});
export type StockSearchResult = z.infer<typeof StockSearchResultSchema>;

export const StockSearchSchema = z.object({
  results: z.array(StockSearchResultSchema),
});
export type StockSearch = z.infer<typeof StockSearchSchema>;

/* ===========================================================================
 *  FX — currency rates  (dataMode: 'poll' — 설계서 §2.2 "환율")
 * ===========================================================================
 *
 *  GET /api/fx?base=USD&symbols=KRW,EUR,JPY → one snapshot of rates, all
 *  expressed RELATIVE TO `base` (so `rates[q]` = how many units of `q` per 1
 *  `base`). Served today from the keyless Frankfurter API (ECB daily rates);
 *  a keyed provider can replace it later behind the same shape.
 *
 *  Direction (a pair moving up/down vs. the previous snapshot) is computed
 *  CLIENT-side from successive polls — the server only publishes the level, so
 *  no per-poll history leaks server-side. Currency codes are ISO-4217.
 */

/** An ISO-4217 currency code (e.g. "USD", "KRW"). Upper-cased by the server. */
export const CurrencyCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{3}$/, "3-letter ISO-4217 code")
  .transform((s) => s.toUpperCase());
export type CurrencyCode = z.infer<typeof CurrencyCodeSchema>;

/**
 * Snapshot response of `GET /api/fx`.
 *  - `base`     : the base currency every rate is relative to.
 *  - `rates`    : quote-code → units-per-1-base (e.g. { KRW: 1378.2, EUR: 0.92 }).
 *  - `date`     : the rate date the provider reported (ISO yyyy-mm-dd) — ECB
 *                 rates are daily, so this may lag "now".
 *  - `provider` : which source served this ("frankfurter" keyless, or a keyed one).
 *  - `stale`    : true when approximate/cached/daily (drives a badge).
 *  - `ts`       : when the server assembled this snapshot (epoch ms).
 */
export const FxRatesSchema = z.object({
  base: CurrencyCodeSchema,
  rates: z.record(z.string(), z.number()),
  /**
   * Day-over-day change per quote code, as a SIGNED percent (e.g. -0.42 = the
   * rate fell 0.42% vs the previous business day). Optional — present when the
   * source can supply a prior-day reference (Frankfurter timeseries).
   */
  changePct: z.record(z.string(), z.number()).optional(),
  date: z.string(),
  provider: z.enum(["frankfurter", "fx-api", "naver"]),
  stale: z.boolean(),
  ts: z.number().int(),
});
export type FxRates = z.infer<typeof FxRatesSchema>;

/* ===========================================================================
 *  WEATHER — current + hourly + daily  (dataMode: 'poll' — 설계서 §2.1 "날씨")
 * ===========================================================================
 *
 *  GET /api/weather?lat=&lon=  (or ?city=) → current conditions + a short
 *  hourly series + a daily forecast for one location. Primary source is KMA
 *  단기예보 (needs KMA_API_KEY + lat/lon→nx/ny grid conversion); the keyless
 *  fallback is Open-Meteo so it works today with no key.
 *
 *  Weather "condition" is a SMALL, source-NEUTRAL enum (not a provider code) so
 *  the widget can pick an icon + a text label — color/icon is never the only
 *  signal. Temperatures are °C; times are epoch ms (server-normalized).
 */

/** Source-neutral sky/precip condition. The widget maps each to an icon + label. */
export const WeatherConditionSchema = z.enum([
  "clear", // 맑음
  "partly-cloudy", // 구름 조금
  "cloudy", // 흐림
  "rain", // 비
  "snow", // 눈
  "sleet", // 진눈깨비
  "thunderstorm", // 뇌우
  "fog", // 안개
  "unknown", // 알 수 없음 (provider gave no usable code)
]);
export type WeatherCondition = z.infer<typeof WeatherConditionSchema>;

/** Current conditions at the location. */
export const WeatherCurrentSchema = z.object({
  /** Air temperature, °C. */
  temp: z.number(),
  /** "Feels-like" temperature, °C (optional — not every source gives it). */
  feelsLike: z.number().optional(),
  /** Source-neutral condition for the icon/label. */
  condition: WeatherConditionSchema,
  /** Relative humidity %, 0–100 (optional). */
  humidity: z.number().optional(),
  /** Wind speed, m/s (optional). */
  windSpeed: z.number().optional(),
  /** Probability of precipitation %, 0–100 (optional). */
  pop: z.number().optional(),
  /**
   * Air temperature at the SAME hour yesterday, °C (optional — only the keyless
   * Open-Meteo path provides it via past_days). Drives the "어제 대비" line.
   */
  tempYesterday: z.number().optional(),
  /** Observation/forecast time for this reading (epoch ms). */
  ts: z.number().int(),
});
export type WeatherCurrent = z.infer<typeof WeatherCurrentSchema>;

/** One hourly forecast point. */
export const WeatherHourSchema = z.object({
  /** Forecast time (epoch ms). */
  ts: z.number().int(),
  /** Temperature, °C. */
  temp: z.number(),
  condition: WeatherConditionSchema,
  /** Probability of precipitation %, 0–100 (optional). */
  pop: z.number().optional(),
});
export type WeatherHour = z.infer<typeof WeatherHourSchema>;

/** One daily forecast point (min/max). */
export const WeatherDaySchema = z.object({
  /** Local calendar date, ISO yyyy-mm-dd. */
  date: z.string(),
  /** Daily low, °C. */
  tempMin: z.number(),
  /** Daily high, °C. */
  tempMax: z.number(),
  condition: WeatherConditionSchema,
  /** Probability of precipitation %, 0–100 (optional). */
  pop: z.number().optional(),
});
export type WeatherDay = z.infer<typeof WeatherDaySchema>;

/**
 * Snapshot response of `GET /api/weather`.
 *  - `location` : resolved place (label + the lat/lon actually used).
 *  - `current`  : conditions now.
 *  - `hourly`   : short hourly series (oldest→newest).
 *  - `daily`    : daily forecast (today→).
 *  - `provider` : "kma" (keyed) or "open-meteo" (keyless fallback).
 *  - `stale`    : true when served from the fallback / cached.
 *  - `ts`       : when the server assembled this snapshot (epoch ms).
 */
export const WeatherSchema = z.object({
  location: z.object({
    label: z.string(),
    lat: z.number(),
    lon: z.number(),
    /**
     * Reverse-geocoded 행정동(동) name for these coordinates (server best-effort,
     * Kakao/Nominatim). Lets the tile show a neighborhood-level place even when the
     * stored label is a coarse city (요구: 실제 동까지 표시). Undefined outside KR or
     * when the lookup fails — the tile then keeps `label`.
     */
    dong: z.string().optional(),
  }),
  current: WeatherCurrentSchema,
  hourly: z.array(WeatherHourSchema),
  daily: z.array(WeatherDaySchema),
  provider: z.enum(["kma", "open-meteo"]),
  stale: z.boolean(),
  ts: z.number().int(),
});
export type Weather = z.infer<typeof WeatherSchema>;

/* ===========================================================================
 *  NEWS — headline list  (dataMode: 'poll' — 설계서 §2.2 "뉴스/RSS")
 * ===========================================================================
 *
 *  GET /api/news?query=…  → a list of recent headlines for a keyword. Primary
 *  source is the Naver News API (NAVER_CLIENT_ID/SECRET); the keyless fallback
 *  is a public Google News RSS for the same keyword, parsed server-side, so it
 *  works today with no key. HTML in titles/summaries is stripped server-side.
 */

/** One headline. `link` is an absolute URL the widget opens in a new tab. */
export const NewsItemSchema = z.object({
  /** Plain-text headline (HTML entities/tags stripped server-side). */
  title: z.string(),
  /** Absolute article URL. */
  link: z.string().url(),
  /** Publisher/source name when known (e.g. "연합뉴스"); "" if unavailable. */
  source: z.string(),
  /** Publish time, epoch ms. Null when the source didn't provide a parseable date. */
  publishedAt: z.number().int().nullable(),
  /** Short plain-text snippet/description (optional). */
  summary: z.string().optional(),
});
export type NewsItem = z.infer<typeof NewsItemSchema>;

/**
 * Snapshot response of `GET /api/news`.
 *  - `query`    : the keyword these headlines are for (echoed back).
 *  - `items`    : headlines, newest-first.
 *  - `provider` : "naver" (keyed) or "rss" (keyless Google News fallback).
 *  - `stale`    : true when served from the fallback / cached.
 *  - `ts`       : when the server assembled this snapshot (epoch ms).
 */
export const NewsListSchema = z.object({
  query: z.string(),
  items: z.array(NewsItemSchema),
  provider: z.enum(["naver", "rss"]),
  stale: z.boolean(),
  ts: z.number().int(),
});
export type NewsList = z.infer<typeof NewsListSchema>;

/* ===========================================================================
 *  CARD — usage / transactions  (read-only snapshot, SENSITIVE — 설계서 §2.1 #9, §5.4)
 * ===========================================================================
 *
 *  The card-usage widget reads `pb_card_transactions` + `pb_cards` DIRECTLY via
 *  the browser Supabase client (RLS-scoped to the signed-in user) and aggregates
 *  client-side, so there is no GET snapshot route. These schemas exist so the
 *  widget, the CSV-import route (POST /api/cards/import), and the token ingest
 *  route (POST /api/cards/ingest) all speak ONE shape — the anti-drift contract.
 *
 *  PRIVACY (D5 guardrail): a card is identified ONLY by its last 4 digits — a
 *  full card number (PAN) is never represented here, accepted, or stored. No raw
 *  SMS/email text appears in any response shape.
 *
 *  `raw_hash` is the sha-256 dedupe key (일시|금액|가맹점); the DB enforces
 *  `unique(user_id, raw_hash)` so re-sent SMS / overlapping CSV rows collapse.
 */

/** Transaction source channel (matches `pb_card_transactions.source`). */
export const CardTxnSourceSchema = z.enum(["sms", "email", "csv", "manual"]);
export type CardTxnSource = z.infer<typeof CardTxnSourceSchema>;

/** Sentinel category for a stored-but-unparsed row (no-loss ingest, §6.4). */
export const CARD_UNRECOGNIZED_CATEGORY = "미인식";

/**
 * One card transaction as the widget reads it from `pb_card_transactions`.
 * Mirrors the table Row; the widget never re-declares this shape.
 */
export const CardTxnSchema = z.object({
  /** Row id (uuid). */
  id: z.string(),
  /** Owning card (uuid → pb_cards.id). */
  card_id: z.string(),
  /** Owner (uuid → auth.users). Present in the Row but never rendered. */
  user_id: z.string(),
  /** Transaction date, ISO yyyy-mm-dd. */
  txn_date: z.string(),
  /** Merchant / 가맹점 (null when unknown). */
  merchant: z.string().nullable(),
  /** Amount in KRW. 0 for an unrecognized row awaiting the user's fix. */
  amount: z.number(),
  /** Category label, or the 미인식 sentinel (null when uncategorized). */
  category: z.string().nullable(),
  /** Where it came from. */
  source: CardTxnSourceSchema,
  /** sha-256 dedupe key (일시|금액|가맹점). */
  raw_hash: z.string(),
});
export type CardTxn = z.infer<typeof CardTxnSchema>;

/**
 * A card master record (`pb_cards`) — last4 ONLY, never a full number.
 */
export const CardSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  /** User-chosen nickname (e.g. "신한 the More"). */
  nickname: z.string(),
  /** Last 4 digits ONLY (null when not provided). Never the full PAN. */
  last4: z.string().nullable(),
  /** Issuer / 카드사 (null when unknown). */
  issuer: z.string().nullable(),
  /** Statement closing day 1–31 (null when not set). */
  billing_day: z.number().nullable(),
  /** Hex color for the card chip (null → default). */
  color: z.string().nullable(),
});
export type Card = z.infer<typeof CardSchema>;

/** One per-category rollup within a month (for the category chart). */
export const CardCategorySummarySchema = z.object({
  category: z.string(),
  /** Total spend in this category, KRW. */
  total: z.number(),
  /** Number of transactions in this category. */
  count: z.number().int(),
});
export type CardCategorySummary = z.infer<typeof CardCategorySummarySchema>;

/** One per-card rollup within a month (for the card-by-card summary). */
export const CardPerCardSummarySchema = z.object({
  card_id: z.string(),
  total: z.number(),
  count: z.number().int(),
});
export type CardPerCardSummary = z.infer<typeof CardPerCardSummarySchema>;

/** One month bucket of the spend trend (for the monthly trend chart). */
export const CardMonthlyPointSchema = z.object({
  /** Month key, ISO yyyy-mm. */
  month: z.string(),
  total: z.number(),
  count: z.number().int(),
});
export type CardMonthlyPoint = z.infer<typeof CardMonthlyPointSchema>;

/**
 * The aggregated summary the widget computes client-side from the raw txns. It
 * is published here so the (client-side) aggregator and any future server route
 * share one shape. Amounts are KRW.
 */
export const CardSummarySchema = z.object({
  /** The month this summary is for, ISO yyyy-mm. */
  month: z.string(),
  /** Total spend in `month` (KRW), excluding 미인식/취소 sentinel rows. */
  monthTotal: z.number(),
  /** Transaction count in `month` (recognized rows only). */
  monthCount: z.number().int(),
  /** Per-category breakdown within `month`, descending by total. */
  byCategory: z.array(CardCategorySummarySchema),
  /** Per-card breakdown within `month`, descending by total. */
  byCard: z.array(CardPerCardSummarySchema),
  /** Spend trend across recent months (oldest→newest). */
  monthly: z.array(CardMonthlyPointSchema),
  /** Count of unrecognized rows needing the user's attention (no-loss queue). */
  unrecognizedCount: z.number().int(),
});
export type CardSummary = z.infer<typeof CardSummarySchema>;

/**
 * Response of `POST /api/cards/ingest` (per-user token; SMS/email forward).
 *  - `ok`           : true when the message was accepted (stored or duplicate).
 *  - `status`       : what happened — 'recognized' | 'duplicate' | 'unrecognized'.
 *  - `category`     : the category the row was stored under (helps the forwarder
 *                     log nothing sensitive — only a coarse label). Omitted on dup.
 *  NOTE: never echoes the token, the raw text, amount, merchant, or last4.
 */
export const CardIngestResponseSchema = z.object({
  ok: z.boolean(),
  status: z.enum(["recognized", "duplicate", "unrecognized"]),
  category: z.string().optional(),
});
export type CardIngestResponse = z.infer<typeof CardIngestResponseSchema>;

/**
 * Response of `POST /api/cards/import` (authenticated session; CSV upload).
 *  - `ok`        : true when the file was processed (even if some rows skipped).
 *  - `inserted`  : rows newly written.
 *  - `skipped`   : rows ignored (duplicates by raw_hash, or unparseable lines).
 *  - `total`     : data rows seen (excludes the header).
 *  - `unrecognized` (optional): rows stored with the 미인식 sentinel (no-loss).
 */
export const CardImportResponseSchema = z.object({
  ok: z.boolean(),
  inserted: z.number().int(),
  skipped: z.number().int(),
  total: z.number().int(),
  unrecognized: z.number().int().optional(),
});
export type CardImportResponse = z.infer<typeof CardImportResponseSchema>;

/* ===========================================================================
 *  CALENDAR — upcoming events  (dataMode: 'poll', Google scope — 설계서 §2.2, §11.1)
 * ===========================================================================
 *
 *  GET /api/calendar → the signed-in owner's upcoming Google Calendar events
 *  (primary calendar, timeMin=now, time-ordered, capped). Auth is email magic
 *  link, so Calendar needs a SEPARATE Google connection: the user links Google
 *  with the `calendar.readonly` scope from the widget (signInWithOAuth), and the
 *  Supabase session then carries a `provider_token` the SERVER uses to call the
 *  Google Calendar API. That token is server-only — it is NEVER serialized into
 *  any response below (no token, no refresh token, no raw Google payload leaks).
 *
 *  DEGRADE-FIRST CONTRACT: when the user has not connected Google (or the token
 *  expired / a refresh failed), the route still returns HTTP 200 with
 *  `connected:false` + `events:[]` — NOT an error. The widget reads that flag and
 *  shows the "Google 연결" CTA instead of crashing or blocking the canvas. Times
 *  are normalized server-side: `start`/`end` are epoch ms; `allDay` events keep
 *  date-only semantics via the flag (their `start` is local midnight).
 */

/** One normalized calendar event. Source-neutral; the widget renders this shape
 *  regardless of how Google returned it (dateTime vs. all-day date). */
export const CalendarEventSchema = z.object({
  /** Stable event id (Google `event.id`). Used as the React key. */
  id: z.string(),
  /** Event title (Google `summary`); "(제목 없음)" when the source omitted it. */
  title: z.string(),
  /** Start time, epoch ms. For all-day events this is local midnight of the day. */
  start: z.number().int(),
  /** End time, epoch ms. For all-day events this is the exclusive end midnight. */
  end: z.number().int(),
  /** True for an all-day / multi-day event (date-only, no clock time). */
  allDay: z.boolean(),
  /** Free-text location when present (Google `location`). */
  location: z.string().optional(),
  /** Source calendar label (e.g. "기본"/primary), when known. */
  calendar: z.string().optional(),
});
export type CalendarEvent = z.infer<typeof CalendarEventSchema>;

/**
 * Snapshot response of `GET /api/calendar`.
 *  - `connected`: whether the server had a usable Google provider token. FALSE is
 *                 a normal 200 state (show the connect CTA), not an error.
 *  - `events`   : upcoming events, time-ordered (soonest first). Empty when not
 *                 connected, or genuinely no upcoming events.
 *  - `error`    : optional short code when a CONNECTED fetch degraded (e.g. the
 *                 Google API was unreachable) — the widget can show a soft notice
 *                 while still rendering. Never carries provider/secret detail.
 *  - `ts`       : when the server assembled this snapshot (epoch ms).
 */
export const CalendarFeedSchema = z.object({
  connected: z.boolean(),
  events: z.array(CalendarEventSchema),
  error: z.string().optional(),
  ts: z.number().int(),
});
export type CalendarFeed = z.infer<typeof CalendarFeedSchema>;

/* ===========================================================================
 *  AIR QUALITY — 대기질·미세먼지  (dataMode: 'poll')
 * ===========================================================================
 *
 *  GET /api/air-quality?lat=&lon=&label= → current pollutant levels for one
 *  location. Source is the **keyless** Open-Meteo Air-Quality API (works today,
 *  no key). Concentrations are µg/m³; `aqi` fields are the European/US AQI
 *  indices when the provider supplies them. The widget grades PM₂.₅/PM₁₀ with
 *  the Korean (환경부) 4-tier standard locally (icon + label — never color-only).
 */
export const AirPollutantsSchema = z.object({
  /** 초미세먼지 PM₂.₅, µg/m³. */
  pm25: z.number().optional(),
  /** 미세먼지 PM₁₀, µg/m³. */
  pm10: z.number().optional(),
  /** 오존 O₃, µg/m³. */
  o3: z.number().optional(),
  /** 이산화질소 NO₂, µg/m³. */
  no2: z.number().optional(),
  /** 아황산가스 SO₂, µg/m³. */
  so2: z.number().optional(),
  /** 일산화탄소 CO, µg/m³. */
  co: z.number().optional(),
  /** European AQI (0–100+), when provided. */
  euAqi: z.number().optional(),
  /** US AQI (0–500), when provided. */
  usAqi: z.number().optional(),
});
export type AirPollutants = z.infer<typeof AirPollutantsSchema>;

/** Snapshot response of `GET /api/air-quality`. */
export const AirQualitySchema = z.object({
  location: z.object({
    label: z.string(),
    lat: z.number(),
    lon: z.number(),
  }),
  current: AirPollutantsSchema,
  /** Observation time for the reading (epoch ms). */
  observedAt: z.number().int(),
  provider: z.literal("open-meteo"),
  /** true when served from the keyless fallback / cache. */
  stale: z.boolean(),
  ts: z.number().int(),
});
export type AirQuality = z.infer<typeof AirQualitySchema>;

/* ===========================================================================
 *  TRANSLATE — 번역기  (on-demand, not poll)
 * ===========================================================================
 *
 *  GET /api/translate?q=&source=&target= → a single translation. Source is the
 *  **keyless** MyMemory API (works today, no key); DeepL is used instead when
 *  DEEPL_API_KEY is present. `source` may be "auto" (let the provider detect);
 *  `detectedSource` reports what it resolved to. Plain text in/out.
 */
export const TranslateSchema = z.object({
  /** The translated text. */
  translatedText: z.string(),
  /** The requested source language ("auto" or an ISO code). */
  source: z.string(),
  /** The requested target language (ISO code). */
  target: z.string(),
  /** Language the provider detected for the input (ISO code), when known. */
  detectedSource: z.string().optional(),
  /** "mymemory" (keyless) or "deepl" (keyed). */
  provider: z.enum(["mymemory", "deepl"]),
  /** Optional soft notice (e.g. quota warning) — never carries secret detail. */
  note: z.string().optional(),
});
export type Translate = z.infer<typeof TranslateSchema>;

/* ===========================================================================
 *  CIRCLE-SCHEDULE — 지인 일정 정리  (LLM 추출 + DB 저장)
 * ===========================================================================
 *
 *  POST /api/circle-schedule/extract { text } → 카카오톡 텍스트에서 뽑아낸 약속
 *  후보 목록. 대상/구분은 서버가 판단하지 않는다(사용자가 UI에서 지정). 저장 전
 *  '검토' 단계의 원천 데이터라 target_id는 여기 없다.
 *
 *  Target / Appointment 스키마는 pb_circle_targets / pb_circle_appointments 행을
 *  방어적으로 검증하기 위한 것(useCircleData가 safeParse) — DB Row와 형태 일치.
 */

/** 추출된 약속 후보 1건(저장 전, 대상 미지정 상태). */
export const ExtractedAppointmentSchema = z.object({
  /** 한 문장 요약(시간 있으면 문장 뒤 괄호 포함). */
  content: z.string(),
  /** 정렬용 ISO8601(+09:00) 또는 null. */
  when_at: z.string().nullable(),
  /** 추출 근거 원본(선택). */
  source: z.string().optional(),
});
export type ExtractedAppointment = z.infer<typeof ExtractedAppointmentSchema>;

/** /api/circle-schedule/extract 응답. */
export const ExtractSchema = z.object({
  appointments: z.array(ExtractedAppointmentSchema),
});
export type Extract = z.infer<typeof ExtractSchema>;

/** 대상(구분) — pb_circle_targets 행. */
export const CircleTargetSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  name: z.string(),
  email: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  sort_order: z.number(),
  created_at: z.string(),
});
export type CircleTarget = z.infer<typeof CircleTargetSchema>;

/** 약속 — pb_circle_appointments 행. */
export const CircleAppointmentSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  target_id: z.string().nullable(),
  content: z.string(),
  when_at: z.string().nullable(),
  source: z.string().nullable(),
  created_at: z.string(),
});
export type CircleAppointment = z.infer<typeof CircleAppointmentSchema>;

/* ===========================================================================
 *  ANDROID WIDGET BRIDGE — 홈 화면 위젯  (/api/widget/*, PLAN-android-widget.md)
 * ===========================================================================
 *
 *  네이티브 위젯(Jetpack Glance)이 쓰는 서버 표면. 웹 세션 대신 **디바이스 토큰**
 *  (Bearer, sha256 해시만 pb_widget_devices에 저장)으로 인증한다. 발급 흐름:
 *  설정 UI가 POST /api/widget/pairing-codes(웹 세션)로 6자리 코드를 받고,
 *  위젯이 POST /api/widget/pair(코드 검증)로 토큰을 교환한다.
 *
 *  GET /api/widget/agenda?days=N  : 오늘부터 N일(KST) 창의 일정. ETag/304 지원.
 *  PATCH /api/widget/appointments/[id] : { status, snoozeUntil? } 상태 변경.
 */

/** 위젯에서 조작 가능한 일정 상태. */
export const WidgetAppointmentStatusSchema = z.enum(["pending", "done", "snoozed"]);
export type WidgetAppointmentStatus = z.infer<typeof WidgetAppointmentStatusSchema>;

/** 아젠다 1행 — pb_circle_appointments + 대상(pb_circle_targets) 파생. */
export const WidgetAgendaItemSchema = z.object({
  id: z.string(),
  /** 약속 한 문장(content — 시간 접미사 포함 원문). */
  title: z.string(),
  /** 대상(구분) 이름 — 미지정이면 null. */
  targetName: z.string().nullable(),
  /** 정렬용 시각(when_at, ISO). 이 API는 시각 있는 일정만 내려보낸다. */
  startAt: z.string(),
  /** 데이터 모델에 종일 개념이 없어 항상 false(계획서 shape 유지용). */
  allDay: z.boolean(),
  status: WidgetAppointmentStatusSchema,
  /** 연기 시각(ISO) — snoozed일 때 아젠다 배치 기준. */
  snoozeUntil: z.string().nullable(),
  /** 대상 색(pb_circle_targets.color) — 좌측 인디케이터용. */
  colorToken: z.string().nullable(),
});
export type WidgetAgendaItem = z.infer<typeof WidgetAgendaItemSchema>;

/** GET /api/widget/agenda 응답. */
export const WidgetAgendaSchema = z.object({
  generatedAt: z.string(),
  items: z.array(WidgetAgendaItemSchema),
});
export type WidgetAgenda = z.infer<typeof WidgetAgendaSchema>;

/** POST /api/widget/pairing-codes 응답(웹 세션 전용). */
export const WidgetPairingCodeSchema = z.object({
  /** 6자리 숫자 코드 — 이 응답에만 존재(서버는 해시만 저장). */
  code: z.string(),
  expiresAt: z.string(),
});
export type WidgetPairingCode = z.infer<typeof WidgetPairingCodeSchema>;

/** POST /api/widget/pair 응답 — 토큰 원문은 이 응답에만 존재. */
export const WidgetPairSchema = z.object({
  token: z.string(),
  deviceId: z.string(),
  label: z.string().nullable(),
});
export type WidgetPair = z.infer<typeof WidgetPairSchema>;

/** 설정 UI 디바이스 목록 행(pb_widget_devices의 클라이언트 노출 컬럼만). */
export const WidgetDeviceSchema = z.object({
  id: z.string(),
  label: z.string().nullable(),
  created_at: z.string(),
  last_seen_at: z.string().nullable(),
});
export type WidgetDevice = z.infer<typeof WidgetDeviceSchema>;

/* ===========================================================================
 *  TASKS — 작업 위젯  (pb_tasks 행 + /api/widget/tasks 브리지)
 * ===========================================================================
 *
 *  웹 '작업' 위젯(useTasks: RLS 직접 CRUD + realtime)과 안드로이드 홈 화면 위젯
 *  (/api/widget/tasks, 디바이스 토큰)이 같은 행을 공유한다. 모바일에 보일 목록은
 *  '작업' 위젯 config의 mobileSync=true 인스턴스(여럿이면 mobileSyncAt 최신)로
 *  서버가 해석한다.
 */

/** 작업 1행 — pb_tasks Row(웹 훅이 safeParse로 방어 검증). */
export const TaskRowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  instance_id: z.string(),
  title: z.string(),
  done: z.boolean(),
  /** 작업 일자(YYYY-MM-DD) — 선택. */
  due_on: z.string().nullable(),
  created_at: z.string(),
});
export type TaskRow = z.infer<typeof TaskRowSchema>;

/** 브리지 응답의 작업 1건(모바일 위젯 표시용 최소 필드). */
export const WidgetTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  done: z.boolean(),
  /** 작업 일자(YYYY-MM-DD) — 선택. */
  dueOn: z.string().nullable(),
  createdAt: z.string(),
});
export type WidgetTask = z.infer<typeof WidgetTaskSchema>;

/** GET /api/widget/tasks 응답 — instanceId=null은 '모바일 표시' 지정 위젯 없음. */
export const WidgetTasksSchema = z.object({
  instanceId: z.string().nullable(),
  items: z.array(WidgetTaskSchema),
});
export type WidgetTasks = z.infer<typeof WidgetTasksSchema>;

/* ---------------------------------------------------------------------------
 *  WIDGET NOTES — 모바일 홈 화면 '노트' 위젯 브리지 (/api/widget/notes)
 * ---------------------------------------------------------------------------
 *
 *  목록 한 줄 = 웹 '노트' 위젯 안의 **소제목 섹션 하나**다(노트 하나가 여러 소제목을
 *  담으므로 노트 한 개로도 목록이 된다). 본문은 pb_widgets.config의
 *  `sections[].html`에 살고, 전용 테이블은 없다.
 *
 *  ⚠ 섹션 본문은 리치 HTML이라 폰의 평문과 왕복하면 서식이 사라진다. 이미지·표가
 *    든 섹션은 `rich: true`로 알리고 폰에서 본문 수정을 막는다(제목 수정·삭제는
 *    허용). 상세는 lib/api/widgetNote.ts 머리말.
 */
export const WidgetNoteItemSchema = z.object({
  /** 이 소제목이 속한 노트 위젯 인스턴스 id(pb_widgets.id). */
  noteId: z.string(),
  /** 소제목 섹션 id(config.sections[].id). noteId와 함께 한 건을 가리킨다. */
  sectionId: z.string(),
  /** 소제목. 비면 서버가 본문 첫 줄·'제목 없음'으로 채운다. */
  title: z.string(),
  /** 본문 평문(HTML에서 변환). 줄바꿈은 살린다. */
  body: z.string(),
  /** 이미지·표가 있어 평문으로 되돌릴 수 없는 섹션 — 폰에서 본문 수정 불가. */
  rich: z.boolean(),
  /** 속한 노트의 제목(어느 노트인지 구분용). 비어 있을 수 있다. */
  noteTitle: z.string(),
  /** 노트 위젯의 마지막 수정 시각(ISO). */
  updatedAt: z.string(),
});
export type WidgetNoteItem = z.infer<typeof WidgetNoteItemSchema>;

/**
 * GET /api/widget/notes 응답 — **지정된 노트 위젯 1개**의 소제목들(표시 순서대로).
 * instanceId=null이면 아직 '모바일 홈 화면에 표시'를 켠 노트가 없다는 뜻이다
 * (폰이 안내를 띄운다 — 작업 위젯과 같은 계약).
 */
export const WidgetNotesSchema = z.object({
  instanceId: z.string().nullable(),
  items: z.array(WidgetNoteItemSchema),
});
export type WidgetNotes = z.infer<typeof WidgetNotesSchema>;

/* ---------------------------------------------------------------------------
 *  WIDGET STOCKS / FX — 모바일 홈 화면 '주식'·'환율' 위젯 브리지
 *  (/api/widget/stocks · /api/widget/fx)
 * ---------------------------------------------------------------------------
 *
 *  작업·노트와 달리 **읽기 전용**이다(폰에서 고칠 것이 없다). 대상은 같은 규칙으로
 *  고른다 — 위젯 속성의 '모바일 홈 화면에 표시'(config.mobileSync)를 켠 인스턴스,
 *  지정이 없고 그 종류의 위젯이 **딱 하나뿐이면 그것**(lib/api/widgetCore.ts의
 *  pickMobileInstanceOrOnly). 폰이 계산하지 않도록 서버가 표시할 값까지 만들어 준다.
 */
export const WidgetStockQuoteSchema = z.object({
  symbol: StockSymbolSchema,
  name: z.string(),
  price: z.number(),
  change: z.number(),
  changePct: z.number(),
  currency: z.string(),
  isIndex: z.boolean(),
  /** 시간외 표식 — StockQuote.session과 같은 값(없으면 정규장). */
  session: z.enum(["pre", "post"]).optional(),
  /**
   * 이번 조회에서 시세를 못 받은 행(업스트림 일시 실패·한도 등).
   * **행 자체는 빠지지 않는다** — 빼면 폰 목록에서 종목이 사라졌다 다시 나타난다
   * (사용자 신고). 폰은 이 표식을 보고 직전에 받은 값을 그대로 유지한다.
   */
  unavailable: z.boolean().optional(),
});
export type WidgetStockQuote = z.infer<typeof WidgetStockQuoteSchema>;

/** GET /api/widget/stocks 응답 — instanceId=null이면 대상 위젯 미지정. */
export const WidgetStocksSchema = z.object({
  instanceId: z.string().nullable(),
  items: z.array(WidgetStockQuoteSchema),
  /** 근사치(키리스 폴백) 여부 — 폰이 배지로 알린다. */
  stale: z.boolean(),
  ts: z.number().int(),
});
export type WidgetStocks = z.infer<typeof WidgetStocksSchema>;

/** 환율 한 줄 — "100 JPY = 943.21원" 형태로 바로 그릴 수 있는 값. */
export const WidgetFxItemSchema = z.object({
  /** 외화 코드(USD·JPY…). */
  code: z.string(),
  /** 표시 단위(엔은 100, 나머지는 1) — 한국에서 보는 관례. */
  unit: z.number(),
  /** `unit` 단위당 원화 값. */
  krw: z.number(),
  /** 전일 대비 퍼센트(원화 값 기준, 부호 있음) — 없을 수 있다. */
  changePct: z.number().optional(),
});
export type WidgetFxItem = z.infer<typeof WidgetFxItemSchema>;

/** GET /api/widget/fx 응답 — instanceId=null이면 대상 위젯 미지정. */
export const WidgetFxSchema = z.object({
  instanceId: z.string().nullable(),
  items: z.array(WidgetFxItemSchema),
  /** 고시 기준일(ISO yyyy-mm-dd) — 없을 수 있다. */
  date: z.string().nullable(),
  stale: z.boolean(),
  /**
   * 환율 조회 자체가 실패했다(items가 비어 있어도 '통화 없음'이 아니라는 뜻).
   * 환율은 한 번에 다 받거나 못 받으므로 주식과 달리 **목록 단위** 표식이다.
   * 폰은 이때 캐시를 덮어쓰지 않는다.
   */
  unavailable: z.boolean().optional(),
  ts: z.number().int(),
});
export type WidgetFx = z.infer<typeof WidgetFxSchema>;

/** 폰 '주식' 위젯의 종목 검색 결과 한 줄(지수·국내·미국 합본). */
export const WidgetSymbolHitSchema = z.object({
  symbol: StockSymbolSchema,
  name: z.string(),
  /** 보조 표기 — 지수는 "지수", 국내는 단축코드, 미국은 거래소·ETF 여부. */
  sub: z.string(),
});
export type WidgetSymbolHit = z.infer<typeof WidgetSymbolHitSchema>;

/** GET /api/widget/stocks/search?q= 응답. */
export const WidgetSymbolSearchSchema = z.object({
  results: z.array(WidgetSymbolHitSchema),
});
export type WidgetSymbolSearch = z.infer<typeof WidgetSymbolSearchSchema>;


/* ===========================================================================
 *  WALK ROUTE — 길찾기(도보) 위젯  (/api/route/walk)
 * ===========================================================================
 *
 *  TMAP 보행자 경로안내 + Open-Meteo 고도를 서버가 합쳐 하나의 정규화된 shape로
 *  내려준다. 위젯은 이 shape만 알면 되고, 두 upstream의 원형(GeoJSON
 *  FeatureCollection / elevation 배열)은 서버 밖으로 나가지 않는다.
 *
 *  좌표는 GeoJSON 관례대로 **[경도, 위도]** 순서다.
 *
 *  ⚠ 서비스 지역 제한: TMAP 보행자 경로는 전국이 아니다(서울·수도권 시지역·6대
 *  광역시·제주도 + 일부 시). 제공되지 않는 구간은 `unsupported_area` 에러로
 *  내려가며, 위젯은 이를 조용한 빈 화면이 아니라 문구로 안내해야 한다.
 */

/** 한 안내 지점(회전·횡단보도·출발/도착). */
export const WalkStepSchema = z.object({
  /** 경로상 순번(0부터). */
  index: z.number(),
  lon: z.number(),
  lat: z.number(),
  /**
   * TMAP 회전 코드 — 아이콘 선택 **전용**. 표시 문구는 `description`을 그대로 쓴다
   * (모르는 코드가 와도 일반 화살표로 폴백하면 되고 안내가 죽지 않는다).
   * 11 직진 · 12 좌회전 · 13 우회전 · 14 유턴 · 16~19 사선방향 · 125 육교 ·
   * 126 지하보도 · 127 계단 · 128 경사로 · 200 출발 · 201 도착 · 211~217 횡단보도 · 218 엘리베이터
   */
  turnType: z.number(),
  /** TMAP이 만든 한국어 안내 문구(예: "이태원역 3번출구에서 우회전 후 27m 이동"). */
  description: z.string(),
  /** 안내 지점 명칭(없으면 빈 문자열). */
  name: z.string(),
  /** SP 출발지 · EP 도착지 · GP 일반 안내점. */
  pointType: z.string(),
  /**
   * 출발지로부터의 **경로상** 누적 거리(m). 서버가 TMAP의 구간 distance를 순서대로
   * 합산해 정확히 계산한다(투영 추정이 아님) — "230m 앞 좌회전"의 기준.
   */
  distanceFromStart: z.number(),
});
export type WalkStep = z.infer<typeof WalkStepSchema>;

/** 고도 프로파일의 한 점. */
export const WalkElevationPointSchema = z.object({
  /** 출발지로부터의 누적 거리(m) — 그래프 X축. */
  distance: z.number(),
  /** 해발 고도(m) — 그래프 Y축. */
  elevation: z.number(),
});
export type WalkElevationPoint = z.infer<typeof WalkElevationPointSchema>;

/** GET /api/route/walk 응답 — 도보 경로 + 고도 프로파일. */
export const WalkRouteSchema = z.object({
  /** 경로 폴리라인 [경도, 위도][] — 지도에 그릴 선이자 현재 위치 투영 대상. */
  path: z.array(z.tuple([z.number(), z.number()])),
  /** 안내 지점(경로 순서). */
  steps: z.array(WalkStepSchema),
  /**
   * 고도 프로파일(거리 오름차순, 최대 100점). 고도 조회에 실패하면 **빈 배열**이며
   * 경로 자체는 정상 응답한다 — 고도는 부가 정보라 지도까지 같이 죽이지 않는다.
   */
  elevation: z.array(WalkElevationPointSchema),
  /** 총 거리(m). */
  totalDistance: z.number(),
  /** 총 소요 시간(초). */
  totalTime: z.number(),
  /** 경로를 감싸는 사각형 — 클라이언트가 컨테이너 크기에 맞춰 지도 중심·줌을 정한다. */
  bounds: z.object({
    west: z.number(),
    south: z.number(),
    east: z.number(),
    north: z.number(),
  }),
  /**
   * 고도 데이터 출처 표기(90m 해상도 근사치임을 UI에 밝히기 위함).
   * 고도가 비면 null.
   */
  elevationSource: z.string().nullable(),
});
export type WalkRoute = z.infer<typeof WalkRouteSchema>;
