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
  date: z.string(),
  provider: z.enum(["frankfurter", "fx-api"]),
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
