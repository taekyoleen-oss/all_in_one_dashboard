/**
 * ============================================================================
 *  GET /api/stocks/stream?symbols=a,b,c — SSE live quotes (설계서 §2.1, §6.5)
 * ============================================================================
 *
 *  Server-Sent Events (text/event-stream). The server subscribes to the active
 *  provider (KIS WebSocket relay when configured, else the keyless poller) and
 *  pushes each updated quote to the browser as it arrives. The widget consumes
 *  this with an EventSource and falls back to polling /api/stocks if SSE drops.
 *
 *  Framing per event (StockStreamEvent in output/api-shapes.ts — the single
 *  source the widget imports):
 *      event: hello|quote|heartbeat\n
 *      data:  <JSON>\n\n
 *
 *  CRITICAL (불변 가드레일): this stream carries QUOTES ONLY. No approval_key,
 *  appkey, or appsecret is ever serialized into a frame — those stay inside the
 *  provider modules on the server.
 *
 *  Lifecycle: on connect we emit `hello`, subscribe, and start a heartbeat. When
 *  the client disconnects, `request.signal` aborts → we unsubscribe the provider
 *  and clear the heartbeat (no leaked sockets/timers).
 *
 *  Route Handler (Next.js 16). force-dynamic + nodejs runtime (the KIS provider
 *  uses a long-lived WebSocket + setInterval, which the edge runtime can't host).
 * ============================================================================
 */

import type { NextRequest } from "next/server";
import { getProvider } from "@/lib/api/stock/provider";
import { parseSymbolsParam } from "@/lib/api/stock/symbols-param";
import type {
  StockStreamEvent,
  StockStreamHello,
  StockStreamQuote,
  StockStreamHeartbeat,
} from "@/output/api-shapes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Heartbeat cadence — keeps proxies from cutting an idle stream. */
const HEARTBEAT_MS = 15_000;

/** Serialize a typed event into an SSE frame (event: + data:). */
function frame(event: StockStreamEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbols = parseSymbolsParam(searchParams.get("symbols"));

  const provider = await getProvider();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let unsubscribe: (() => void) | null = null;
      let heartbeat: ReturnType<typeof setInterval> | null = null;

      const send = (event: StockStreamEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(frame(event)));
        } catch {
          // Controller already closed (client gone) — stop pushing.
          cleanup();
        }
      };

      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        heartbeat = null;
        try {
          unsubscribe?.();
        } catch {
          /* best-effort */
        }
        unsubscribe = null;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      // Abort when the client disconnects → tear everything down.
      request.signal.addEventListener("abort", cleanup);

      // 1) hello — announce provider + staleness (never any credential).
      const hello: StockStreamHello = {
        type: "hello",
        provider: provider.id,
        stale: provider.stale,
        ts: Date.now(),
      };
      send(hello);

      // 2) subscribe — push a `quote` event per provider tick.
      if (symbols.length > 0) {
        unsubscribe = provider.subscribe(symbols, (quote) => {
          const evt: StockStreamQuote = { type: "quote", quote };
          send(evt);
        });
      }

      // 3) heartbeat — periodic keep-alive + staleness clock for the client.
      heartbeat = setInterval(() => {
        const beat: StockStreamHeartbeat = { type: "heartbeat", ts: Date.now() };
        send(beat);
      }, HEARTBEAT_MS);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      // Disable proxy buffering (nginx) so events flush immediately.
      "x-accel-buffering": "no",
    },
  });
}
