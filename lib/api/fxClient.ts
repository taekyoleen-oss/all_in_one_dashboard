/**
 * ============================================================================
 *  FX client — currency rates, keyless, WORKS TODAY (설계서 §2.2, §11.1)
 * ============================================================================
 *
 *  SERVER-ONLY. Normalizes external rate data into the shared `FxRates` shape
 *  (output/api-shapes.ts — the anti-drift single source).
 *
 *  ── Sources ───────────────────────────────────────────────────────────────
 *   • PRIMARY (KRW 기준): 네이버 금융 시세(하나은행 고시환율) — `api.stock.naver.com`
 *     이 평일 장중 여러 차례(고시회차) 갱신되는 준실시간 원화 환율을 준다. 본인용
 *     대시보드 표시 목적의 서버 프록시이며, 재배포는 하지 않는다(가드레일).
 *   • FALLBACK: keyless Frankfurter(ECB 일일 기준환율). 네이버가 실패하거나 KRW
 *     이외를 기준으로 요청할 때 사용 — 키 없이 항상 동작하는 안전망.
 *
 *  The widget always polls with base=KRW (foreign currency → 원), so Naver is the
 *  effective live source; Frankfurter only kicks in on failure. The route never
 *  exposes any upstream key to the client.
 *
 *  Caching is handled at the route layer (Next `revalidate` + Cache-Control);
 *  this module just fetches + normalizes and never throws raw upstream errors.
 * ============================================================================
 */

// SERVER-ONLY: imported only from app/api/fx/route.ts.
import type { FxRates } from "@/output/api-shapes";

/** Per-request timeout so a slow upstream can't wedge the route. */
const FETCH_TIMEOUT_MS = 8_000;
const FRANKFURTER_BASE = "https://api.frankfurter.app/latest";
/** Timeseries endpoint — used to read the latest + previous business day at once. */
const FRANKFURTER_SERIES = "https://api.frankfurter.app";

/** 네이버 금융 환율 시세(통화별 FX_{code}KRW). 서버에서만 호출. */
const NAVER_FX_ENDPOINT = "https://api.stock.naver.com/marketindex/exchange";
/** 일부 통화는 100단위로 고시된다(엔화 = 100엔당 원). 우리 기본셋에선 JPY만 해당. */
const NAVER_PER_100 = new Set(["JPY"]);
/** 네이버는 브라우저성 헤더가 없으면 차단할 수 있어 UA/Referer를 붙인다(주식·뉴스 프록시와 동일 패턴). */
const NAVER_HEADERS = {
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Referer: "https://m.stock.naver.com/",
} as const;

/** Default base + quote currencies when the request omits them. */
export const DEFAULT_FX_BASE = "USD";
export const DEFAULT_FX_SYMBOLS = ["KRW", "EUR", "JPY", "CNY"] as const;

/** Shape we read out of Frankfurter's /latest response. */
interface FrankfurterLatest {
  base?: string;
  date?: string;
  rates?: Record<string, number>;
}

/** The subset of the 네이버 exchange payload we consume (nested under exchangeInfo). */
interface NaverExchangeInfo {
  /** 현재 고시 환율(원). 천단위 콤마 포함 문자열, 예: "1,535.60". */
  closePrice?: string;
  /** 전일 대비 변동률(부호 없는 크기, 예: "0.17"). 방향은 fluctuationsType에. */
  fluctuationsRatio?: string;
  /** 등락 방향. name = RISING | FALLING | STEADY | UPPER_LIMIT | LOWER_LIMIT. */
  fluctuationsType?: { code?: string; name?: string; text?: string };
  /** 고시 시각(ISO, +09:00). */
  localTradedAt?: string;
}

/** Normalize a free-form currency token to an upper-cased 3-letter code, or null. */
export function normalizeCode(raw: string): string | null {
  const c = raw.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(c) ? c : null;
}

/** Parse a comma/space separated `symbols` param into unique valid codes. */
export function parseSymbolsParam(
  raw: string | null,
  fallback: readonly string[] = DEFAULT_FX_SYMBOLS,
): string[] {
  if (!raw) return [...fallback];
  const seen = new Set<string>();
  for (const part of raw.split(/[,\s]+/)) {
    const code = normalizeCode(part);
    if (code) seen.add(code);
  }
  return seen.size > 0 ? [...seen] : [...fallback];
}

/**
 * Fetch + normalize current rates for `base` → each of `symbols`.
 * Returns a fully-formed `FxRates` on success, or `null` on any failure (the
 * route maps null to a typed error — never a raw upstream error).
 *
 * Dispatch: a KRW-based request (the widget's only mode) prefers 네이버 고시환율;
 * on failure it transparently falls back to Frankfurter. Any other base goes
 * straight to Frankfurter (네이버 시세는 원화 크로스만 제공).
 */
export async function fetchRates(
  base: string,
  symbols: string[],
): Promise<FxRates | null> {
  const baseCode = normalizeCode(base) ?? DEFAULT_FX_BASE;
  const wanted = symbols
    .map(normalizeCode)
    .filter((c): c is string => c !== null && c !== baseCode);

  // Nothing left to ask for (e.g. base==quote): return a trivial 1.0 snapshot.
  if (wanted.length === 0) {
    return {
      base: baseCode,
      rates: { [baseCode]: 1 },
      date: new Date().toISOString().slice(0, 10),
      provider: "frankfurter",
      stale: true,
      ts: Date.now(),
    };
  }

  if (baseCode === "KRW") {
    const naver = await fetchFromNaver(wanted);
    if (naver) return naver;
    // 네이버 실패 → ECB 기준환율로 안전 강등.
  }

  return fetchFromFrankfurter(baseCode, wanted);
}

/* ------------------------------ 네이버 (primary) -------------------------- */

/** Strip thousands separators and parse a 네이버 numeric string. */
function parseNaverNumber(raw: string | undefined): number | null {
  if (typeof raw !== "string") return null;
  const n = Number(raw.replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

/**
 * Signed 전일대비 % of the KRW-per-currency value (KRW-per-code 기준 부호).
 *
 * 주의: 네이버 `fluctuationsRatio`는 이미 부호가 붙어 온다(하락 시 "-0.45", 상승 시 "0.45").
 * 따라서 크기로 쓰려면 절댓값을 취하고, 방향은 명시적 등락 enum(`fluctuationsType`)에서
 * 가져온다. 예전 구현은 부호가 붙은 ratio에 type 부호를 한 번 더 곱해, FALLING(하락) 날에
 * 부호가 뒤집혀 '상승'으로 표시되는 버그가 있었다(주말엔 직전 거래일이 하락이면 네 통화 모두
 * 반대로 보임). type을 알 수 없을 땐 부호 붙은 ratio를 그대로 신뢰한다(안전 폴백).
 */
export function signedNaverRatio(info: NaverExchangeInfo): number {
  const raw = parseNaverNumber(info.fluctuationsRatio);
  if (raw === null) return 0;
  const mag = Math.abs(raw);
  const name = info.fluctuationsType?.name ?? "";
  if (name === "RISING" || name === "UPPER_LIMIT") return mag;
  if (name === "FALLING" || name === "LOWER_LIMIT") return -mag;
  if (name === "STEADY") return 0;
  return raw; // 알 수 없는 타입 → 부호 붙은 ratio를 그대로 사용
}

/** Fetch one currency's KRW 고시환율 from 네이버, normalized to the widget's shape. */
async function fetchOneNaver(
  code: string,
  signal: AbortSignal,
): Promise<{ cPerKrw: number; changePctCPerKrw: number; tradedAt: string | null } | null> {
  try {
    const res = await fetch(`${NAVER_FX_ENDPOINT}/FX_${code}KRW`, {
      signal,
      headers: NAVER_HEADERS,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { exchangeInfo?: NaverExchangeInfo };
    const info = json.exchangeInfo;
    if (!info) return null;

    const close = parseNaverNumber(info.closePrice);
    if (close === null || close <= 0) return null;

    // 네이버 closePrice = KRW per `per` units of `code` (JPY는 100단위). 자연단위(1단위)
    // 원화값으로 환산한 뒤, 위젯이 기대하는 "code per 1 KRW"로 뒤집어 둔다.
    const per = NAVER_PER_100.has(code) ? 100 : 1;
    const krwPerOne = close / per;
    const cPerKrw = 1 / krwPerOne;

    // 위젯은 서버의 changePct(=code-per-KRW 기준)를 음수화해 원화값 방향을 복원한다.
    // 원화값(KRW-per-code) 등락이 signed면, code-per-KRW 기준은 -signed.
    const changePctCPerKrw = -signedNaverRatio(info);

    return { cPerKrw, changePctCPerKrw, tradedAt: info.localTradedAt ?? null };
  } catch {
    return null;
  }
}

/** Build a KRW-based FxRates from 네이버 고시환율; null if every currency failed. */
async function fetchFromNaver(wanted: string[]): Promise<FxRates | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const results = await Promise.all(
      wanted.map((code) => fetchOneNaver(code, controller.signal)),
    );

    const rates: Record<string, number> = { KRW: 1 };
    const changePct: Record<string, number> = { KRW: 0 };
    let tradedAt: string | null = null;
    let any = false;

    wanted.forEach((code, i) => {
      const r = results[i];
      if (!r) return;
      any = true;
      rates[code] = r.cPerKrw;
      changePct[code] = r.changePctCPerKrw;
      if (!tradedAt && r.tradedAt) tradedAt = r.tradedAt;
    });

    if (!any) return null;

    return {
      base: "KRW",
      rates,
      changePct,
      date: (tradedAt ?? new Date().toISOString()).slice(0, 10),
      provider: "naver",
      // 고시회차 기반 준실시간 — '일별 근사' 라벨을 띄우지 않도록 stale=false.
      stale: false,
      ts: Date.now(),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* --------------------------- Frankfurter (fallback) ----------------------- */

/**
 * Frankfurter timeseries → latest rates + previous business day in ONE call,
 * yielding day-over-day change. Used as the fallback path and for non-KRW bases.
 *
 * Frankfurter rejects a request whose `from` equals one of `to`, and silently
 * omits the base from `rates`; the caller already filtered the base out of
 * `wanted`, and we re-add it as 1.0 so the widget can show "1 base = 1 base".
 */
async function fetchFromFrankfurter(
  baseCode: string,
  wanted: string[],
): Promise<FxRates | null> {
  // Pull the last ~10 days as a timeseries so we get BOTH the latest rates and
  // the previous business day in ONE call → day-over-day change (전일 대비 증감).
  const since = new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10);
  const seriesUrl = `${FRANKFURTER_SERIES}/${since}..?from=${encodeURIComponent(
    baseCode,
  )}&to=${encodeURIComponent(wanted.join(","))}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(seriesUrl, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      // Route-level caching governs freshness; avoid Next's default fetch cache here.
      cache: "no-store",
    });
    if (!res.ok) return await fetchLatestOnly(baseCode, wanted, controller);
    const json = (await res.json()) as {
      rates?: Record<string, Record<string, number>>;
    };
    const byDate = json.rates ?? {};
    const dates = Object.keys(byDate).sort();
    if (dates.length === 0) return await fetchLatestOnly(baseCode, wanted, controller);

    const latest = byDate[dates[dates.length - 1]] ?? {};
    const prev = dates.length > 1 ? byDate[dates[dates.length - 2]] : undefined;

    const rates: Record<string, number> = { [baseCode]: 1 };
    const changePct: Record<string, number> = { [baseCode]: 0 };
    for (const [code, value] of Object.entries(latest)) {
      if (typeof value === "number" && Number.isFinite(value)) {
        rates[code] = value;
        const p = prev?.[code];
        if (typeof p === "number" && Number.isFinite(p) && p !== 0) {
          changePct[code] = ((value - p) / p) * 100;
        }
      }
    }

    return {
      base: baseCode,
      rates,
      changePct,
      date: dates[dates.length - 1],
      provider: "frankfurter",
      // ECB rates are daily reference rates, not live — flag as approximate.
      stale: true,
      ts: Date.now(),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Fallback to the /latest snapshot (no change data) if the timeseries fails. */
async function fetchLatestOnly(
  baseCode: string,
  wanted: string[],
  controller: AbortController,
): Promise<FxRates | null> {
  try {
    const url = `${FRANKFURTER_BASE}?from=${encodeURIComponent(
      baseCode,
    )}&to=${encodeURIComponent(wanted.join(","))}`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as FrankfurterLatest;
    if (!json.rates || typeof json.rates !== "object") return null;
    const rates: Record<string, number> = { [baseCode]: 1 };
    for (const [code, value] of Object.entries(json.rates)) {
      if (typeof value === "number" && Number.isFinite(value)) rates[code] = value;
    }
    return {
      base: baseCode,
      rates,
      date:
        typeof json.date === "string"
          ? json.date
          : new Date().toISOString().slice(0, 10),
      provider: "frankfurter",
      stale: true,
      ts: Date.now(),
    };
  } catch {
    return null;
  }
}
