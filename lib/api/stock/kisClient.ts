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
 *  Access token is cached in-process for ~24h (KIS issues 24h tokens and rate-
 *  limits issuance). Credentials (appkey/appsecret) live here only and are sent
 *  exclusively to KIS — never to the browser, never into an SSE frame.
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

const KIS_BASE = "https://openapi.koreainvestment.com:9443";
const TOKEN_URL = `${KIS_BASE}/oauth2/tokenP`;
const STOCK_PRICE_URL = `${KIS_BASE}/uapi/domestic-stock/v1/quotations/inquire-price`;
// VERIFY(kis): index-price path + tr_id. Confirm against the portal for your app.
const INDEX_PRICE_URL = `${KIS_BASE}/uapi/domestic-stock/v1/quotations/inquire-index-price`;

const TR_STOCK = "FHKST01010100"; // 국내주식 현재가
const TR_INDEX = "FHPUP02100000"; // 업종/지수 현재가  // VERIFY(kis)

/** KIS domestic index codes for the KR indices we support. */
const KR_INDEX_CODE: Record<string, string> = {
  "^KS11": "0001", // 코스피
  "^KQ11": "1001", // 코스닥
};

/* --------------------------- access-token cache --------------------------- */

interface TokenCache {
  token: string;
  /** Epoch ms after which the token is considered expired (refresh proactively). */
  expiresAt: number;
}
let tokenCache: TokenCache | null = null;
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

  // Refresh ~10 min before the stated expiry; default to 23h if absent.
  const ttlSec = typeof json.expires_in === "number" ? json.expires_in : 23 * 3600;
  tokenCache = {
    token: json.access_token,
    expiresAt: Date.now() + Math.max(60, ttlSec - 600) * 1000,
  };
  return json.access_token;
}

/** Get a cached token, issuing/refreshing as needed. Coalesces concurrent issuance. */
async function getToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) return tokenCache.token;
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
    change: Number.isFinite(magnitude) ? magnitude * factor : 0,
    changePct: Number.isFinite(pct) ? pct * (factor === 0 ? 1 : factor) : 0,
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
    change: Number.isFinite(magnitude) ? magnitude * factor : 0,
    changePct: Number.isFinite(pct) ? pct * (factor === 0 ? 1 : factor) : 0,
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

  // Seed everything once via REST so the widget paints immediately (indices too).
  void getQuotesImpl(symbols).then(({ quotes }) => {
    if (stopped) return;
    for (const q of quotes) onTick(q);
  });

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
          // Errors are swallowed here; the route also keeps a REST poll as backstop.
          onError: () => {},
        });
      })
      .catch(() => {
        // VERIFY(kis): if approval/socket fails live, the snapshot poll still covers it.
      });
  }

  return () => {
    stopped = true;
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
