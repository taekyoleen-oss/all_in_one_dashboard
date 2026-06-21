/**
 * ============================================================================
 *  KIS real-time WebSocket → server-side tick relay (설계서 §6.5)
 * ============================================================================
 *
 *  SERVER-ONLY. Opens ONE WebSocket to KIS, authenticates with an `approval_key`
 *  (issued server-side, NEVER sent to the browser), subscribes to the requested
 *  domestic-stock symbols, parses the pipe(^)-delimited real-time ticks, and
 *  hands normalized `StockQuote`s to a callback. The SSE route consumes that
 *  callback and re-emits quotes only — credentials never leave the server.
 *
 *  READ-ONLY: subscribes to 체결가 (trade price, tr_id H0STCNT0) only. No order
 *  or balance realtime topics anywhere.
 *
 *  Researched from the official `koreainvestment/open-trading-api` samples:
 *    • approval_key : POST https://openapi.koreainvestment.com:9443/oauth2/Approval
 *                     body {grant_type:"client_credentials", appkey, secretkey}
 *                     → { approval_key }
 *    • ws endpoint  : ws://ops.koreainvestment.com:21000/tryitout/H0STCNT0
 *    • subscribe    : { header:{ approval_key, custtype:"P", tr_type:"1",
 *                       "content-type":"utf-8" },
 *                       body:{ input:{ tr_id:"H0STCNT0", tr_key:<6-digit code> }}}
 *    • tick frame   : "0|H0STCNT0|001|<^-delimited body>" — body fields:
 *                       [0] MKSC_SHRN_ISCD  종목코드
 *                       [1] STCK_CNTG_HOUR  체결시각
 *                       [2] STCK_PRPR       현재가(체결가)
 *                       [3] PRDY_VRSS_SIGN  전일대비부호 (1상한 2상승 3보합 4하한 5하락)
 *                       [4] PRDY_VRSS       전일대비(절대값) — sign applied from [3]
 *                       [5] PRDY_CTRT       전일대비율(%)
 *
 *  Anything that needs a live socket to confirm is marked `// VERIFY(kis):` —
 *  KIS_* are empty today so this path is structured but not yet exercised.
 * ============================================================================
 */

// SERVER-ONLY: loaded transitively via kisClient.ts (dynamic import). Holds the
// approval_key / appsecret — never exposed to the client.
// Uses the global `WebSocket` Web API (standard in Node 18+/Next runtime) — no
// extra dependency. This is the browser-compatible client, not the `ws` package.
import type { StockQuote } from "@/output/api-shapes";
import { resolveMeta } from "./symbols";
import {
  readCachedSecret,
  writeCachedSecret,
  invalidateCachedSecret,
  CACHE_KEY,
} from "./tokenStore";

const APPROVAL_URL =
  "https://openapi.koreainvestment.com:9443/oauth2/Approval";

/**
 * Realtime approval keys are valid ~24h but the endpoint returns no expires_in,
 * so we cache for a conservative 23h. A socket auth failure self-heals via
 * invalidateApprovalKey() (called by the realtime client), so a stale key never
 * sticks for the full window.
 */
const APPROVAL_TTL_MS = 23 * 60 * 60 * 1000;

// VERIFY(kis): the realtime host/port/path. The samples use ops.koreainvestment.com:21000;
// some accounts/regions use a different path segment. Confirm against your approved app.
const WS_URL = "ws://ops.koreainvestment.com:21000/tryitout/H0STCNT0";

const REALTIME_TR_ID = "H0STCNT0"; // 국내주식 실시간 체결가 (read-only)

// Coalesce concurrent issuance within this process; cross-restart reuse is the
// persistent store's job (tokenStore.ts).
let approvalInFlight: Promise<string> | null = null;

/** Request a fresh approval_key from KIS and persist it for reuse across restarts. */
async function requestApprovalKey(): Promise<string> {
  const appkey = process.env.KIS_APP_KEY?.trim();
  const secret = process.env.KIS_APP_SECRET?.trim();
  if (!appkey || !secret) throw new Error("KIS credentials missing");

  const res = await fetch(APPROVAL_URL, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      appkey,
      // NOTE: the approval endpoint expects `secretkey` (NOT `appsecret`) per the samples.
      secretkey: secret,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`KIS approval failed: ${res.status}`);
  }
  const json = (await res.json()) as { approval_key?: string };
  if (!json.approval_key) throw new Error("KIS approval: no approval_key in response");
  await writeCachedSecret(
    CACHE_KEY.approvalKey,
    json.approval_key,
    Date.now() + APPROVAL_TTL_MS,
  );
  return json.approval_key;
}

/**
 * Get a websocket approval_key (server-side, never sent to client), reusing the
 * persisted one until it nears expiry so reconnects/restarts don't re-issue.
 * Concurrent callers in this process share a single in-flight issuance.
 */
export async function issueApprovalKey(): Promise<string> {
  const cached = await readCachedSecret(CACHE_KEY.approvalKey);
  if (cached) return cached;
  if (approvalInFlight) return approvalInFlight;
  approvalInFlight = requestApprovalKey().finally(() => {
    approvalInFlight = null;
  });
  return approvalInFlight;
}

/** Drop the cached approval key so the next issueApprovalKey() re-issues a fresh one. */
export async function invalidateApprovalKey(): Promise<void> {
  await invalidateCachedSecret(CACHE_KEY.approvalKey);
}

/** Map prdy_vrss_sign → numeric multiplier (+1 up, −1 down, 0 flat). */
function signFactor(sign: string): number {
  // 1 상한 / 2 상승 → +,  4 하한 / 5 하락 → −,  3 보합 → 0
  if (sign === "1" || sign === "2") return 1;
  if (sign === "4" || sign === "5") return -1;
  return 0;
}

/** Build the subscribe/unsubscribe frame for one symbol's trade-price topic. */
function buildSubscribeFrame(
  approvalKey: string,
  code: string,
  subscribe: boolean,
): string {
  return JSON.stringify({
    header: {
      approval_key: approvalKey,
      custtype: "P",
      tr_type: subscribe ? "1" : "0", // 1 = subscribe, 0 = unsubscribe
      "content-type": "utf-8",
    },
    body: { input: { tr_id: REALTIME_TR_ID, tr_key: code } },
  });
}

/**
 * Parse one raw KIS realtime frame into a StockQuote, or null if it isn't a
 * H0STCNT0 data frame (control/PINGPONG/JSON frames are handled by the caller).
 *
 *  Data frame layout: "<encrypt>|<tr_id>|<count>|<body>" where body is one or
 *  more records joined by "^"; multiple records would repeat the field block,
 *  but for a single subscription we read the first record's fields.
 */
export function parseTradeFrame(
  raw: string,
  symbolForCode: (code: string) => string | undefined,
): StockQuote | null {
  // Data frames begin with "0|" (unencrypted) or "1|" (encrypted). We do not
  // enable encryption, so expect "0|H0STCNT0|<count>|<body>". The body uses "^"
  // (never "|"), so the first 3 "|" delimit encrypt | tr_id | count | body.
  if (!raw.startsWith("0|") && !raw.startsWith("1|")) return null;
  const parts = raw.split("|");
  if (parts.length < 4 || parts[1] !== REALTIME_TR_ID) return null;

  // Rejoin in case a body field ever contained "|" (defensive — spec says it won't).
  const body = parts.slice(3).join("|");
  const f = body.split("^");
  // Need at least up to PRDY_CTRT (index 5).
  if (f.length < 6) return null;

  const code = f[0];
  const symbol = symbolForCode(code) ?? code;
  const meta = resolveMeta(symbol);

  const price = Number(f[2]);
  const magnitude = Number(f[4]);
  const pct = Number(f[5]);
  if (!Number.isFinite(price)) return null;

  const factor = signFactor(f[3]);
  const change = Number.isFinite(magnitude) ? magnitude * factor : 0;
  const changePct = Number.isFinite(pct) ? pct * (factor === 0 ? 1 : factor) : 0;

  return {
    symbol,
    name: meta.name,
    price,
    change,
    changePct,
    ts: Date.now(),
    currency: meta.currency,
    isIndex: meta.isIndex,
  };
}

export interface KisSocketHandle {
  close: () => void;
}

/**
 * Open a KIS realtime socket for the given KR codes and stream normalized quotes
 * to `onQuote`. Returns a handle whose `close()` unsubscribes + tears down the
 * socket. `codeToSymbol` maps a KIS 6-digit code back to the requested symbol
 * (so ".KS"/".KQ" suffixes are preserved in the emitted quote).
 *
 *  VERIFY(kis): end-to-end behavior (handshake, PINGPONG keep-alive, frame
 *  layout) needs a live approved app to confirm. Structure follows the samples.
 */
export function openKisRealtime(opts: {
  approvalKey: string;
  codes: string[];
  codeToSymbol: (code: string) => string | undefined;
  onQuote: (q: StockQuote) => void;
  onError?: (err: Error) => void;
}): KisSocketHandle {
  const { approvalKey, codes, codeToSymbol, onQuote, onError } = opts;
  let closed = false;

  // Global Web API WebSocket (Node runtime provides it). Frames arrive as strings.
  const ws = new WebSocket(WS_URL);

  ws.addEventListener("open", () => {
    for (const code of codes) {
      ws.send(buildSubscribeFrame(approvalKey, code, true));
    }
  });

  ws.addEventListener("message", (event: MessageEvent) => {
    const raw =
      typeof event.data === "string" ? event.data : String(event.data);
    // KIS sends a JSON control frame for subscribe ACK + PINGPONG keep-alive.
    if (raw.startsWith("{")) {
      try {
        const msg = JSON.parse(raw) as { header?: { tr_id?: string } };
        // Echo PINGPONG back to keep the connection alive.
        if (msg.header?.tr_id === "PINGPONG") {
          ws.send(raw);
        }
      } catch {
        /* ignore malformed control frame */
      }
      return;
    }
    const quote = parseTradeFrame(raw, codeToSymbol);
    if (quote) onQuote(quote);
  });

  ws.addEventListener("error", () => {
    if (!closed) onError?.(new Error("KIS websocket error"));
  });

  return {
    close: () => {
      if (closed) return;
      closed = true;
      try {
        if (ws.readyState === WebSocket.OPEN) {
          for (const code of codes) {
            ws.send(buildSubscribeFrame(approvalKey, code, false));
          }
        }
        ws.close();
      } catch {
        /* best-effort teardown */
      }
    },
  };
}
