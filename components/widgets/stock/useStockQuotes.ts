"use client";

/**
 * useStockQuotes — live quotes for a set of symbols (설계서 §2.1, dataMode:'stream').
 *
 *  Subscribes to the server SSE stream (/api/stocks/stream) with an EventSource,
 *  validating each frame against the shared schemas in output/api-shapes.ts (the
 *  anti-drift single source — types are IMPORTED, never re-declared here). Falls
 *  back to polling /api/stocks when SSE errors or isn't available, so the widget
 *  always shows data. Keeps a short rolling price history per symbol to feed a
 *  mini-sparkline.
 *
 *  Instance isolation: each hook call owns ONE EventSource keyed by the symbol
 *  set, so two stock widgets with different lists hold independent subscriptions
 *  (설계서 §4.1). The subscription resets when the symbol list changes.
 *
 *  Genuine external-source subscription (EventSource), set up in an effect — the
 *  React-19-safe pattern (same shape as useNow).
 */

import * as React from "react";
import {
  StockSnapshotSchema,
  StockStreamEventSchema,
  type StockQuote,
} from "@/output/api-shapes";

/** How many recent prices to retain per symbol for the sparkline. */
const HISTORY_LEN = 30;
/** Poll cadence for the fallback path when SSE is unavailable. */
const POLL_MS = 12_000;

export type ConnState = "connecting" | "live" | "polling" | "idle";

export interface StockQuotesState {
  /** symbol → latest quote (only resolved symbols appear). */
  quotes: Map<string, StockQuote>;
  /** symbol → recent price points (oldest→newest) for the sparkline. */
  history: Map<string, number[]>;
  /** Which provider is serving (for a source/stale badge). */
  provider: "kis" | "fallback" | null;
  /** True when data is approximate/polled (fallback). */
  stale: boolean;
  /** Connection status for the UI. */
  conn: ConnState;
  /** symbols the server could not resolve (show "—"). */
  errors: string[];
}

/** Stable key for a symbol list (order-insensitive) to detect real changes. */
function symbolsKey(symbols: string[]): string {
  return [...symbols].sort().join(",");
}

export function useStockQuotes(symbols: string[]): StockQuotesState {
  const key = symbolsKey(symbols);

  const [quotes, setQuotes] = React.useState<Map<string, StockQuote>>(
    () => new Map(),
  );
  const [history, setHistory] = React.useState<Map<string, number[]>>(
    () => new Map(),
  );
  const [provider, setProvider] = React.useState<"kis" | "fallback" | null>(
    null,
  );
  const [stale, setStale] = React.useState(false);
  const [conn, setConn] = React.useState<ConnState>("idle");
  const [errors, setErrors] = React.useState<string[]>([]);

  // Apply one quote into both the latest-map and the rolling history.
  const applyQuote = React.useCallback((q: StockQuote) => {
    setQuotes((prev) => {
      const next = new Map(prev);
      next.set(q.symbol, q);
      return next;
    });
    setHistory((prev) => {
      const next = new Map(prev);
      const arr = next.get(q.symbol) ?? [];
      const appended = [...arr, q.price];
      next.set(
        q.symbol,
        appended.length > HISTORY_LEN
          ? appended.slice(appended.length - HISTORY_LEN)
          : appended,
      );
      return next;
    });
  }, []);

  React.useEffect(() => {
    // No synchronous setState here: all state changes below happen in response to
    // the external stream (hello/quote frames, poll responses) — the React-19-safe
    // shape. Stale map entries from a removed symbol are simply never read (views
    // look up only the current `config.symbols`), so no reset pass is needed.
    if (symbols.length === 0) {
      // Nothing to subscribe to; leave state as-is (views render the empty case).
      return;
    }

    let cancelled = false;
    let es: EventSource | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    const qs = encodeURIComponent(symbols.join(","));

    // ---- polling fallback (used if SSE errors) ----
    const pollOnce = async () => {
      try {
        const res = await fetch(`/api/stocks?symbols=${qs}`, {
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const parsed = StockSnapshotSchema.safeParse(await res.json());
        if (!parsed.success || cancelled) return;
        setProvider(parsed.data.provider);
        setStale(parsed.data.stale);
        setErrors(parsed.data.errors);
        for (const q of parsed.data.quotes) applyQuote(q);
      } catch {
        /* transient network error — next tick retries */
      }
    };

    const startPolling = () => {
      if (pollTimer) return;
      setConn("polling");
      void pollOnce();
      pollTimer = setInterval(() => void pollOnce(), POLL_MS);
    };

    // ---- SSE primary path ----
    const startSse = () => {
      setConn("connecting");
      try {
        es = new EventSource(`/api/stocks/stream?symbols=${qs}`);
      } catch {
        startPolling();
        return;
      }

      es.addEventListener("hello", (ev) => {
        const parsed = StockStreamEventSchema.safeParse(
          safeJson((ev as MessageEvent).data),
        );
        if (parsed.success && parsed.data.type === "hello") {
          setProvider(parsed.data.provider);
          setStale(parsed.data.stale);
          setConn("live");
        }
      });

      es.addEventListener("quote", (ev) => {
        const parsed = StockStreamEventSchema.safeParse(
          safeJson((ev as MessageEvent).data),
        );
        if (parsed.success && parsed.data.type === "quote") {
          applyQuote(parsed.data.quote);
        }
      });

      // heartbeat frames need no action beyond keeping the socket warm.

      es.onerror = () => {
        // EventSource auto-reconnects, but if it's failing, fall back to polling
        // so the widget keeps updating. Close the failing source first.
        if (cancelled) return;
        es?.close();
        es = null;
        startPolling();
      };
    };

    // Prefer SSE when the browser supports EventSource; else poll.
    if (typeof EventSource !== "undefined") {
      startSse();
    } else {
      startPolling();
    }

    return () => {
      cancelled = true;
      es?.close();
      es = null;
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
    };
    // Re-subscribe only when the symbol SET changes (key), not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, applyQuote]);

  return { quotes, history, provider, stale, conn, errors };
}

/** Parse JSON, returning null on failure (defensive against malformed frames). */
function safeJson(data: unknown): unknown {
  if (typeof data !== "string") return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export default useStockQuotes;
