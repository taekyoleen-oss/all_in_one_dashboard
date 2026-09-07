"use client";

/**
 * useAutoReroute — 경로를 벗어난 상태가 이어지면 스스로 다시 찾는다.
 *
 *  걷다가 길을 놓쳤을 때 사용자가 버튼을 찾아 누르게 하는 건 번거롭다. 이탈이
 *  `DELAY_MS` 동안 계속되면 현재 위치를 출발지로 경로를 다시 계산한다.
 *
 *  ── 왜 즉시가 아니라 지연인가 ─────────────────────────────────────────────
 *  GPS는 건물 사이에서 순간적으로 수십 m씩 튄다. 튈 때마다 경로를 다시 부르면
 *  TMAP 호출이 폭증하고 화면도 계속 흔들린다. 잠깐 벗어난 것과 정말 다른 길로 간
 *  것을 가르는 게 이 지연이다.
 *
 *  ── 취소 ─────────────────────────────────────────────────────────────────
 *  일부러 다른 길로 가는 중일 수 있으므로 `cancel()`로 막을 수 있다. 취소는
 *  **이번 이탈에 대해서만** 유효하다 — 경로로 돌아왔다가 다시 벗어나면 자동 재검색이
 *  되살아난다(한 번 취소했다고 영영 꺼지면 그것대로 곤란하다).
 */

import * as React from "react";

/** 이탈이 이만큼 이어지면 다시 찾는다. */
export const AUTO_REROUTE_DELAY_MS = 10_000;

export interface AutoRerouteState {
  /** 자동 재검색이 예약된 상태(카운트다운 중). */
  pending: boolean;
  /** 이번 이탈에 대해 사용자가 취소했다. */
  cancelled: boolean;
  /** 이번 이탈의 자동 재검색을 취소한다. */
  cancel: () => void;
}

export function useAutoReroute({
  offRoute,
  enabled,
  onReroute,
}: {
  /** 지금 경로를 벗어나 있는가. */
  offRoute: boolean;
  /** 자동 재검색이 의미 있는가(출발지가 '현재 위치'일 때만). */
  enabled: boolean;
  onReroute: () => void;
}): AutoRerouteState {
  const [cancelled, setCancelled] = React.useState(false);
  // 이탈 상태가 바뀌는 순간을 렌더 중에 감지한다(effect로 하면 한 박자 늦다).
  const [prevOff, setPrevOff] = React.useState(offRoute);

  if (prevOff !== offRoute) {
    setPrevOff(offRoute);
    // 경로로 돌아오면 취소를 푼다 — 다음 이탈은 다시 자동으로 찾아야 한다.
    if (!offRoute && cancelled) setCancelled(false);
  }

  // 최신 콜백을 참조로 들고 있어야 타이머가 옛 클로저를 붙잡지 않는다.
  const rerouteRef = React.useRef(onReroute);
  React.useEffect(() => {
    rerouteRef.current = onReroute;
  }, [onReroute]);

  const armed = offRoute && enabled && !cancelled;

  React.useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => rerouteRef.current(), AUTO_REROUTE_DELAY_MS);
    return () => clearTimeout(id);
  }, [armed]);

  const cancel = React.useCallback(() => setCancelled(true), []);

  return { pending: armed, cancelled, cancel };
}

export default useAutoReroute;
