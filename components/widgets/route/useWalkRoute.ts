"use client";

/**
 * useWalkRoute — /api/route/walk 한 건(도보 경로 + 고도).
 *
 *  공용 `usePoll`을 재사용하되 주기를 **24시간**으로 둔다. 도보 경로는 하루 단위로
 *  바뀌지 않으므로 사실상 "한 번만 부르기 + 명시적 재탐색"이고, 라우트의
 *  s-maxage=86400과 같은 리듬이다(계획서 §3 — TMAP 무료 한도를 거의 쓰지 않는 이유).
 *
 *  ── 출발·도착을 바꿔도 바로 부르지 않는다 ─────────────────────────────────
 *  경로는 **걸어 잠근 값(latch)** 으로만 만든다. 출발·도착을 고쳐도 잠금은 그대로라
 *  경로가 다시 계산되지 않고, 지도만 새 지점을 미리 보여준다. 사용자가 '탐색'을
 *  눌러 `searchKey`를 올렸을 때만 지금 값으로 다시 잠그고 새 경로를 가져온다.
 *
 *  이렇게 나눈 이유는 두 가지다. ① 출발과 도착을 잇달아 고치면 경로를 두 번 부르게
 *  된다(무료 한도는 하루 1,000건). ② 출발지가 '현재 위치'면 GPS가 갱신될 때마다
 *  좌표가 흔들려 URL이 계속 바뀐다 — 걷는 동안 재요청이 일어나면 안 된다.
 *
 *  첫 잠금은 값이 갖춰지는 즉시 이뤄진다 — 이미 설정된 위젯을 열었을 때 '탐색'을
 *  눌러야 지도가 나오면 곤란하다.
 *
 *  ⚠ 좌표를 반올림해서 URL을 안정시키려던 초기 방식은 폐기했다 — 0.001° 격자는 약
 *    111m라, 사용자가 고른 **도착지를 최대 110m 옮겨버렸다**(경로 끝에 서 있는데
 *    "80m 앞 도착"이 뜨는 것으로 발각). 좌표는 이제 그대로 보낸다.
 */

import * as React from "react";
import { WalkRouteSchema, type WalkRoute } from "@/output/api-shapes";
import { usePoll, type PollState } from "@/components/widgets/shared/usePoll";
import type { RoutePurpose } from "@/lib/widgets/route/purpose";
import type { RoutePlace } from "./types";

/** 24시간 — 사실상 '한 번만'. */
export const WALK_REFRESH_MS = 86_400_000;

/** 실제로 경로를 만든 조건(지금 설정과 비교해 '탐색 필요'를 판정한다). */
export interface SearchedRoute {
  start: RoutePlace;
  end: RoutePlace;
  via: RoutePlace[];
  /** 이동 목적 — 서버가 이걸로 티맵 searchOption을 정한다. */
  purpose: RoutePurpose;
  avoidStairs: boolean;
}

export type WalkRouteState = PollState<WalkRoute> & {
  /** 지금 화면의 경로가 어떤 출발·도착으로 만들어졌는가. 아직 없으면 null. */
  searched: SearchedRoute | null;
};

export function useWalkRoute(
  start: RoutePlace | null,
  end: RoutePlace | null,
  via: RoutePlace[],
  purpose: RoutePurpose,
  avoidStairs: boolean,
  /** 올리면 지금 값으로 다시 잠그고 새로 탐색한다('탐색'·'다시 계산'·자동 재검색). */
  searchKey = 0,
): WalkRouteState {
  const [latched, setLatched] = React.useState<{
    key: number;
    value: SearchedRoute;
  } | null>(null);

  // 렌더 중 상태 조정 — props가 바뀔 때 상태를 맞추는 React 공식 패턴이다
  // (effect로 하면 한 프레임 늦게 잡히고 그 사이 옛 경로가 보인다).
  if (start && end && (!latched || latched.key !== searchKey)) {
    setLatched({
      key: searchKey,
      value: { start, end, via, purpose, avoidStairs },
    });
  }
  const searched = latched?.key === searchKey ? latched.value : null;

  const url = React.useMemo(() => {
    if (!searched) return "";
    const q = new URLSearchParams({
      sx: String(searched.start.lon),
      sy: String(searched.start.lat),
      ex: String(searched.end.lon),
      ey: String(searched.end.lat),
      sname: searched.start.label || "출발",
      ename: searched.end.label || "도착",
    });
    q.set("purpose", searched.purpose);
    if (searched.avoidStairs) q.set("avoidStairs", "1");
    // 경유지는 "lon,lat|lon,lat" — 순서가 곧 들르는 순서다.
    if (searched.via.length > 0) {
      q.set("via", searched.via.map((p) => `${p.lon},${p.lat}`).join("|"));
    }
    return `/api/route/walk?${q}`;
  }, [searched]);

  const poll = usePoll(url, WalkRouteSchema, {
    intervalMs: WALK_REFRESH_MS,
    enabled: url !== "",
  });

  return { ...poll, searched };
}

export default useWalkRoute;
