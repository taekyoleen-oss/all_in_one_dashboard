/**
 * ============================================================================
 *  KIS provider — REST quotes + realtime subscription (설계서 §6.5)
 * ============================================================================
 *
 *  SERVER-ONLY. The live provider behind getProvider() when STOCK_PROVIDER==='kis'
 *  and KIS_* credentials are present. Implements StockQuoteProvider:
 *    • getQuotes  → KIS REST current-price (도메스틱) + index price.
 *    • subscribe  → KIS realtime WebSocket relay (kisWebSocket.ts).
 *
 *  Access token is cached PERSISTENTLY (file-backed, see tokenStore.ts) for ~24h.
 *  KIS issues 24h tokens AND pushes a KakaoTalk message on every issuance, so the
 *  cache must survive process restarts — otherwise each redeploy / cold start /
 *  dev reload re-issues a token and spams a notification. Credentials
 *  (appkey/appsecret) live here only and are sent exclusively to KIS — never to
 *  the browser, never into an SSE frame.
 *
 *  READ-ONLY: current-price + index-price quotations only. No order/balance.
 *
 *  Researched endpoints (official koreainvestment/open-trading-api samples):
 *    • token  : POST .../oauth2/tokenP  {grant_type:"client_credentials",appkey,appsecret}
 *               → { access_token, access_token_token_expired, expires_in }
 *    • stock  : GET  .../uapi/domestic-stock/v1/quotations/inquire-price
 *               headers {authorization:"Bearer …",appkey,appsecret,tr_id:"FHKST01010100",custtype:"P"}
 *               query   {FID_COND_MRKT_DIV_CODE:"J", FID_INPUT_ISCD:<code>}
 *               output  {stck_prpr, prdy_vrss, prdy_ctrt, prdy_vrss_sign, hts_kor_isnm}
 *    • index  : GET  .../uapi/domestic-stock/v1/quotations/inquire-index-price
 *               tr_id "FHPUP02100000", {FID_COND_MRKT_DIV_CODE:"U", FID_INPUT_ISCD:"0001"|"1001"}
 *               output {bstp_nmix_prpr, bstp_nmix_prdy_vrss, prdy_vrss_sign, bstp_nmix_prdy_ctrt}
 *  `// VERIFY(kis):` marks anything needing a live approved app to confirm.
 * ============================================================================
 */

// SERVER-ONLY: loaded via dynamic import from provider.ts. Holds KIS credentials
// (read from process.env) which are sent ONLY to KIS, never to the browser.
import type { StockQuote, StockSymbol } from "@/output/api-shapes";
import type { OnTick, StockQuoteProvider, Unsubscribe } from "./provider";
import {
  isKrIndex,
  isUsIndex,
  krCode,
  resolveMeta,
} from "./symbols";
import {
  issueApprovalKey,
  openKisRealtime,
  type KisSocketHandle,
} from "./kisWebSocket";
import {
  readCachedSecret,
  writeCachedSecret,
  CACHE_KEY,
} from "./tokenStore";

const KIS_BASE = "https://openapi.koreainvestment.com:9443";
const TOKEN_URL = `${KIS_BASE}/oauth2/tokenP`;
const STOCK_PRICE_URL = `${KIS_BASE}/uapi/domestic-stock/v1/quotations/inquire-price`;
// VERIFY(kis): index-price path + tr_id. Confirm against the portal for your app.
const INDEX_PRICE_URL = `${KIS_BASE}/uapi/domestic-stock/v1/quotations/inquire-index-price`;

const TR_STOCK = "FHKST01010100"; // 국내주식 현재가
const TR_INDEX = "FHPUP02100000"; // 업종/지수 현재가  // VERIFY(kis)

/** REST re-poll cadence for the live subscription (keeps quotes fresh w/o the WS). */
const REST_POLL_MS = 15_000;

/** KIS domestic index codes for the KR indices we support. */
const KR_INDEX_CODE: Record<string, string> = {
  "^KS11": "0001", // 코스피
  "^KQ11": "1001", // 코스닥
};

/* --------------------------- access-token cache --------------------------- */

// Coalesces concurrent issuance WITHIN this process; cross-restart reuse is the
// persistent store's job (tokenStore.ts → file-backed). Together they ensure a
// token is issued ~once per 24h regardless of restarts, so KIS sends at most one
// KakaoTalk notification per day instead of one per process start.
let tokenInFlight: Promise<string> | null = null;

async function issueToken(): Promise<string> {
  const appkey = process.env.KIS_APP_KEY?.trim();
  const appsecret = process.env.KIS_APP_SECRET?.trim();
  if (!appkey || !appsecret) throw new Error("KIS credentials missing");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      appkey,
      appsecret,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`KIS token failed: ${res.status}`);
  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number; // seconds (KIS issues 24h tokens)
  };
  if (!json.access_token) throw new Error("KIS token: no access_token in response");

  // Refresh ~10 min before the stated expiry; default to 23h if absent. Persist
  // so the very next restart reuses this token instead of re-issuing (→ no new
  // KakaoTalk push).
  const ttlSec = typeof json.expires_in === "number" ? json.expires_in : 23 * 3600;
  const expiresAt = Date.now() + Math.max(60, ttlSec - 600) * 1000;
  await writeCachedSecret(CACHE_KEY.accessToken, json.access_token, expiresAt);
  // Diagnostic: this line prints ONLY when a NEW token is actually issued (i.e.,
  // when KIS pushes a KakaoTalk). After a restart you should see it at most ONCE
  // per ~24h. If it never prints but KakaoTalk still arrives, the issuer is
  // another program sharing the same KIS appkey (Python 스크립트·HTS·다른 앱) —
  // KIS allows ONE active token per appkey, so each external issuance invalidates
  // this cache and forces a re-issue here. Use a separate appkey per program.
  console.warn(
    `[KIS] 새 접근토큰 발급됨 → 캐시 저장(${new Date(expiresAt).toLocaleString("ko-KR")}까지 재사용). 이 로그가 자주 보이면 같은 appkey를 쓰는 다른 프로그램이 있는지 확인하세요.`,
  );
  return json.access_token;
}

/**
 * Get a token, reusing the persisted one until it nears expiry; only issue a new
 * one (→ a KakaoTalk push) when none is cached or it has expired. Concurrent
 * callers in this process share a single in-flight issuance.
 */
async function getToken(): Promise<string> {
  const cached = await readCachedSecret(CACHE_KEY.accessToken);
  if (cached) return cached;
  if (tokenInFlight) return tokenInFlight;
  tokenInFlight = issueToken().finally(() => {
    tokenInFlight = null;
  });
  return tokenInFlight;
}

/* ------------------------------- REST quotes ------------------------------ */

/** Common KIS quotation headers (read-only quote tr_ids only). */
function quoteHeaders(token: string, trId: string): HeadersInit {
  const appkey = process.env.KIS_APP_KEY?.trim() ?? "";
  const appsecret = process.env.KIS_APP_SECRET?.trim() ?? "";
  return {
    authorization: `Bearer ${token}`,
    appkey,
    appsecret,
    tr_id: trId,
    custtype: "P",
    "content-type": "application/json; charset=utf-8",
  };
}

/** prdy_vrss_sign → multiplier (+1 up, −1 down, 0 flat). */
function signFactor(sign: string | undefined): number {
  if (sign === "1" || sign === "2") return 1;
  if (sign === "4" || sign === "5") return -1;
  return 0;
}

/** Fetch one individual KR stock current price. */
async function fetchStock(
  symbol: StockSymbol,
  code: string,
  token: string,
): Promise<StockQuote | null> {
  const params = new URLSearchParams({
    FID_COND_MRKT_DIV_CODE: "J", // J = KRX
    FID_INPUT_ISCD: code,
  });
  const res = await fetch(`${STOCK_PRICE_URL}?${params}`, {
    headers: quoteHeaders(token, TR_STOCK),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    output?: {
      stck_prpr?: string;
      prdy_vrss?: string;
      prdy_ctrt?: string;
      prdy_vrss_sign?: string;
      hts_kor_isnm?: string;
    };
  };
  const o = json.output;
  if (!o || o.stck_prpr === undefined) return null;

  const meta = resolveMeta(symbol);
  const price = Number(o.stck_prpr);
  if (!Number.isFinite(price)) return null;
  const factor = signFactor(o.prdy_vrss_sign);
  const magnitude = Number(o.prdy_vrss ?? "0");
  const pct = Number(o.prdy_ctrt ?? "0");

  return {
    symbol,
    name: o.hts_kor_isnm?.trim() || meta.name,
    price,
    // KIS returns prdy_vrss/prdy_ctrt ALREADY SIGNED. Derive the sign solely from
    // the authoritative sign code on the absolute magnitude — otherwise a signed
    // value × the sign factor double-applies and FLIPS 상승/하락 (bug fix).
    change: Number.isFinite(magnitude) ? Math.abs(magnitude) * factor : 0,
    changePct: Number.isFinite(pct)
      ? Math.abs(pct) * (factor === 0 ? 1 : factor)
      : 0,
    ts: Date.now(),
    currency: "KRW",
    isIndex: false,
  };
}

/** Fetch one KR index current price. */
async function fetchIndex(
  symbol: StockSymbol,
  indexCode: string,
  token: string,
): Promise<StockQuote | null> {
  const params = new URLSearchParams({
    FID_COND_MRKT_DIV_CODE: "U", // U = 업종/지수
    FID_INPUT_ISCD: indexCode,
  });
  const res = await fetch(`${INDEX_PRICE_URL}?${params}`, {
    headers: quoteHeaders(token, TR_INDEX),
    cache: "no-store",
  });
  if (!res.ok) return null;
  // VERIFY(kis): index output field names. Samples vary by version; these are the
  // documented 업종지수 fields. Confirm with a live call.
  const json = (await res.json()) as {
    output?: {
      bstp_nmix_prpr?: string;
      bstp_nmix_prdy_vrss?: string;
      bstp_nmix_prdy_ctrt?: string;
      prdy_vrss_sign?: string;
    };
  };
  const o = json.output;
  if (!o || o.bstp_nmix_prpr === undefined) return null;

  const meta = resolveMeta(symbol);
  const price = Number(o.bstp_nmix_prpr);
  if (!Number.isFinite(price)) return null;
  const factor = signFactor(o.prdy_vrss_sign);
  const magnitude = Number(o.bstp_nmix_prdy_vrss ?? "0");
  const pct = Number(o.bstp_nmix_prdy_ctrt ?? "0");

  return {
    symbol,
    name: meta.name,
    price,
    // Signed value × sign-code factor would double-apply → flip; use abs × factor.
    change: Number.isFinite(magnitude) ? Math.abs(magnitude) * factor : 0,
    changePct: Number.isFinite(pct)
      ? Math.abs(pct) * (factor === 0 ? 1 : factor)
      : 0,
    ts: Date.now(),
    currency: "KRW",
    isIndex: true,
  };
}

async function getQuotesImpl(
  symbols: StockSymbol[],
): Promise<{ quotes: StockQuote[]; errors: StockSymbol[] }> {
  let token: string;
  try {
    token = await getToken();
  } catch {
    // Token issuance failed → whole batch is in error (route degrades to fallback).
    return { quotes: [], errors: [...symbols] };
  }

  const settled = await Promise.all(
    symbols.map(async (symbol) => {
      try {
        if (isKrIndex(symbol)) {
          const code = KR_INDEX_CODE[symbol];
          return { symbol, q: code ? await fetchIndex(symbol, code, token) : null };
        }
        if (isUsIndex(symbol)) {
          // VERIFY(kis): KIS exposes overseas indices via a different (해외) API
          // surface. Until wired, US indices resolve via the fallback path.
          return { symbol, q: null };
        }
        const code = krCode(symbol);
        return { symbol, q: code ? await fetchStock(symbol, code, token) : null };
      } catch {
        return { symbol, q: null };
      }
    }),
  );

  const quotes: StockQuote[] = [];
  const errors: StockSymbol[] = [];
  for (const { symbol, q } of settled) {
    if (q) quotes.push(q);
    else errors.push(symbol);
  }
  return { quotes, errors };
}

/* ---------------------------- realtime subscribe -------------------------- */

/**
 * Subscribe to live KR-stock ticks over the KIS WebSocket. Index symbols and US
 * symbols have no H0STCNT0 topic, so they are seeded once via REST and then left
 * to the snapshot/poll path (the SSE route still re-polls the snapshot for them).
 */
function subscribeImpl(symbols: StockSymbol[], onTick: OnTick): Unsubscribe {
  let stopped = false;
  let handle: KisSocketHandle | null = null;

  // Build code→symbol map for KR individual stocks (the only realtime-capable set).
  const codeToSymbol = new Map<string, StockSymbol>();
  const codes: string[] = [];
  for (const s of symbols) {
    if (isKrIndex(s) || isUsIndex(s)) continue;
    const code = krCode(s);
    if (code) {
      codeToSymbol.set(code, s);
      codes.push(code);
    }
  }

  // Seed + KEEP POLLING via REST so prices stay current even when the realtime
  // WebSocket is unavailable (the ws relay needs an approved app and often can't
  // connect; without this, quotes would freeze at the seed → "현재가와 안 맞음").
  // Emits only changed quotes to limit SSE frames. The socket below, when it does
  // connect, layers faster tick updates on top.
  const lastPrice = new Map<string, number>();
  const pollOnce = async () => {
    if (stopped) return;
    const { quotes } = await getQuotesImpl(symbols);
    if (stopped) return;
    for (const q of quotes) {
      if (lastPrice.get(q.symbol) !== q.price) {
        lastPrice.set(q.symbol, q.price);
        onTick(q);
      }
    }
  };
  void pollOnce();
  const pollId = setInterval(() => void pollOnce(), REST_POLL_MS);

  // Open the realtime socket for KR stocks (if any).
  if (codes.length > 0) {
    void issueApprovalKey()
      .then((approvalKey) => {
        if (stopped) return;
        handle = openKisRealtime({
          approvalKey,
          codes,
          codeToSymbol: (c) => codeToSymbol.get(c),
          onQuote: (q) => {
            if (!stopped) onTick(q);
          },
          // Swallow socket errors: the REST seed already painted the widget and
          // the route keeps a REST poll backstop. We deliberately do NOT drop the
          // cached approval key here — a flaky/unreachable socket would otherwise
          // force repeated re-issuance (churn). The 23h TTL refreshes it instead;
          // invalidateApprovalKey() stays available for explicit recovery.
          onError: () => {},
        });
      })
      .catch(() => {
        // VERIFY(kis): if approval/socket fails live, the snapshot poll still covers it.
      });
  }

  return () => {
    stopped = true;
    clearInterval(pollId);
    handle?.close();
    handle = null;
  };
}

/** Construct the KIS live provider. */
export function createKisProvider(): StockQuoteProvider {
  return {
    id: "kis",
    stale: false,
    getQuotes: getQuotesImpl,
    subscribe: subscribeImpl,
  };
}
