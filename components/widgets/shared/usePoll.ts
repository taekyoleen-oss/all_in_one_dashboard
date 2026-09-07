"use client";

/**
 * usePoll — periodic GET + Zod-validated JSON for poll-mode widgets
 * (환율/날씨/뉴스, dataMode:'poll' — 설계서 §9.4).
 *
 *  Fetches `url` immediately, then every `intervalMs`, validating each response
 *  body with the provided Zod schema (the route already validated its own output
 *  against the SAME schema in output/api-shapes.ts — this is the client-side
 *  defensive half of the anti-drift contract: a malformed body is dropped, never
 *  crashes the widget). Types flow from the schema, so callers never re-declare
 *  the payload shape.
 *
 *  Instance isolation: the subscription is keyed by `url`, and `url` is built
 *  from THIS instance's config (e.g. ?base=&symbols= / ?lat=&lon= / ?query=), so
 *  two widgets with different settings poll independently and a config change
 *  re-subscribes (설계서 §4.1).
 *
 *  Good-citizen polling: skips ticks while the tab is hidden and fires an
 *  immediate refresh when it becomes visible again, so background tiles don't
 *  burn the upstream. Set `enabled:false` to pause entirely (e.g. empty config).
 *
 *  External-source subscription set up in an effect — the React-19-safe pattern
 *  (same shape as useStockQuotes / useNow): no synchronous setState in render.
 */

import * as React from "react";
import type { z } from "zod";

export interface PollState<T> {
  /** Latest validated payload, or null until the first success. */
  data: T | null;
  /** True only during the very first load (no data yet). */
  loading: boolean;
  /** A short error code when the last attempt failed AND we have no data. */
  error: string | null;
  /**
   * 서버가 에러 본문에 담아 보낸 사용자용 문구(`{ error, message }` 봉투의 message).
   * 라우트가 이유를 알고 있을 때만 채워진다 — 예: 길찾기의 "이 지역은 도보 경로가
   * 제공되지 않습니다". 없으면 null이고, 그 경우 호출부가 자기 문구를 쓴다.
   * (기존 위젯들은 이 필드를 읽지 않으므로 추가돼도 동작이 바뀌지 않는다.)
   */
  message: string | null;
  /** epoch ms of the last successful update (for a "갱신: …" line). */
  lastUpdated: number | null;
  /** Force an out-of-band refresh (e.g. a manual 새로고침 button). */
  refresh: () => void;
}

interface PollOptions {
  /** Poll period in ms. */
  intervalMs: number;
  /** When false, no fetching happens (paused). Default true. */
  enabled?: boolean;
}

export function usePoll<S extends z.ZodTypeAny>(
  url: string,
  schema: S,
  { intervalMs, enabled = true }: PollOptions,
): PollState<z.infer<S>> {
  type T = z.infer<S>;

  const [data, setData] = React.useState<T | null>(null);
  // tick 클로저가 초기 data(null)를 영구 캡처하지 않도록 최신 data를 ref로 미러링
  // — "데이터가 있으면 에러를 숨긴다" 판정은 항상 dataRef.current로 한다.
  const dataRef = React.useRef<T | null>(null);
  React.useEffect(() => {
    dataRef.current = data;
  }, [data]);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = React.useState<number | null>(null);
  // Bumping this re-runs the effect for a manual refresh.
  const [nonce, setNonce] = React.useState(0);

  const refresh = React.useCallback(() => setNonce((n) => n + 1), []);

  React.useEffect(() => {
    if (!enabled || !url) return;

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const tick = async () => {
      // Don't fetch while hidden; the visibility handler refreshes on return.
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (cancelled) return;
        if (!res.ok) {
          // 라우트가 이유를 아는 경우 그 문구를 살려 둔다(에러 봉투 { error, message }).
          // 본문이 JSON이 아니거나 비어 있어도 조용히 넘어간다 — 어차피 부가 정보다.
          const body = (await res.json().catch(() => null)) as
            | { error?: unknown; message?: unknown }
            | null;
          if (cancelled) return;
          setMessage(typeof body?.message === "string" ? body.message : null);
          const code = typeof body?.error === "string" ? body.error : "request_failed";
          // Keep showing stale data if we have any; only surface an error when empty.
          setError((prev) => (dataRef.current === null ? code : prev));
          return;
        }
        const json: unknown = await res.json();
        if (cancelled) return;
        const parsed = schema.safeParse(json);
        if (!parsed.success) {
          setError((prev) => (dataRef.current === null ? "bad_shape" : prev));
          return;
        }
        setData(parsed.data as T);
        setLastUpdated(Date.now());
        setError(null);
        setMessage(null);
      } catch {
        if (cancelled) return;
        setError((prev) => (dataRef.current === null ? "network_error" : prev));
      }
    };

    void tick();
    timer = setInterval(() => void tick(), intervalMs);

    const onVisible = () => {
      if (typeof document !== "undefined" && !document.hidden) void tick();
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisible);
    }

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisible);
      }
    };
    // Re-subscribe when the target URL, cadence, enabled flag, or manual nonce change.
    // `data` is intentionally excluded (including it would reset the interval on
    // every successful poll); error-suppression checks read the latest value via
    // `dataRef` instead, so the tick closure never goes stale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, intervalMs, enabled, nonce]);

  // `loading` is derived (avoids setState-in-effect): true only before the first
  // result while an active subscription is in flight.
  const loading = enabled && !!url && data === null && error === null;

  return { data, loading, error, message, lastUpdated, refresh };
}

export default usePoll;
