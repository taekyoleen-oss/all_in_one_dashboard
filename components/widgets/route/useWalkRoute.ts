"use client";

/**
 * useWalkRoute — /api/route/walk 한 건(도보 경로 + 고도).
 *
 *  공용 `usePoll`을 재사용하되 주기를 **24시간**으로 둔다. 도보 경로는 하루 단위로
 *  바뀌지 않으므로 사실상 "한 번만 부르기 + 수동 새로고침"이고, 라우트의
 *  s-maxage=86400과 같은 리듬이다(계획서 §3 — TMAP 무료 한도를 거의 쓰지 않는 이유).
 *
 *  ── 걸어가는 동안 재요청하지 않기 ──────────────────────────────────────────
 *  출발지가 '현재 위치'면 GPS가 갱신될 때마다 좌표가 바뀌어 URL(=구독 키)이 흔들린다.
 *  그래서 **첫 좌표를 걸어 잠근다(latch)**: 경로는 그 좌표 하나로 한 번만 만들고,
 *  이후 이동은 받아둔 폴리라인에 투영해 표시한다(재계산 없음).
 *
 *  잠금은 목적지·옵션이 바뀌거나 `retryKey`가 증가할 때만 풀린다(= 사용자가 '경로 다시
 *  계산'을 눌렀을 때).
 *
 *  ⚠ 좌표를 반올림해서 URL을 안정시키려던 초기 방식은 폐기했다 — 0.001° 격자는 약
 *    111m라, 사용자가 고른 **도착지를 최대 110m 옮겨버렸다**(실브라우저에서 경로 끝에
 *    서 있는데 "80m 앞 도착"이 뜨는 것으로 발각). 좌표는 이제 그대로 보낸다.
 */

import * as React from "react";
import { WalkRouteSchema, type WalkRoute } from "@/output/api-shapes";
import { usePoll, type PollState } from "@/components/widgets/shared/usePoll";
import type { RoutePlace } from "./types";

/** 24시간 — 사실상 '한 번만'. */
export const WALK_REFRESH_MS = 86_400_000;

export type WalkRouteState = PollState<WalkRoute>;

const placeKey = (p: RoutePlace | null): string =>
  p ? `${p.lat},${p.lon},${p.label}` : "-";

export function useWalkRoute(
  start: RoutePlace | null,
  end: RoutePlace | null,
  avoidStairs: boolean,
  /** 증가시키면 출발지 잠금을 풀고 현재 좌표로 다시 계산한다. */
  retryKey = 0,
): WalkRouteState {
  // 출발지 잠금은 '무엇이 바뀌면 다시 잡을지'를 이 키가 정한다.
  const latchKey = `${placeKey(end)}|${avoidStairs}|${retryKey}`;
  const [latched, setLatched] = React.useState<{
    key: string;
    origin: RoutePlace;
  } | null>(null);

  // 렌더 중 상태 조정 — props가 바뀔 때 상태를 맞추는 React 공식 패턴이다
  // (effect로 하면 한 프레임 늦게 잡히고 그 사이 옛 경로가 보인다).
  if (start && (!latched || latched.key !== latchKey)) {
    setLatched({ key: latchKey, origin: start });
  }
  const origin = latched?.key === latchKey ? latched.origin : null;

  const url = React.useMemo(() => {
    if (!origin || !end) return "";
    const q = new URLSearchParams({
      sx: String(origin.lon),
      sy: String(origin.lat),
      ex: String(end.lon),
      ey: String(end.lat),
      sname: origin.label || "출발",
      ename: end.label || "도착",
    });
    if (avoidStairs) q.set("avoidStairs", "1");
    return `/api/route/walk?${q}`;
  }, [origin, end, avoidStairs]);

  return usePoll(url, WalkRouteSchema, {
    intervalMs: WALK_REFRESH_MS,
    enabled: url !== "",
  });
}

export default useWalkRoute;
