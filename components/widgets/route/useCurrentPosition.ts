"use client";

/**
 * useCurrentPosition — 기기 GPS 위치.
 *
 *  출발지가 '현재 위치'(config.start === null)일 때 출발 좌표를 얻고, 전체보기에서는
 *  `watch: true`로 이동을 따라간다(요구 2의 "현재 위치에서 몇 미터 앞").
 *
 *  구독은 effect 안에서만 만든다(React 19 안전 패턴 — 렌더 중 setState 없음).
 *  권한 거부·미지원은 에러 문자열로 표면화한다 — 조용히 빈 화면이 되면 사용자가
 *  왜 안 되는지 알 수 없다.
 *
 *  ⚠ HTTPS(또는 localhost)에서만 동작한다. 배포는 Vercel이라 충족.
 */

import * as React from "react";

export interface CurrentPosition {
  lat: number;
  lon: number;
  /** GPS가 보고한 수평 정확도(m). 이탈 판정에서 관대함의 근거가 된다. */
  accuracy: number;
  /** 이 좌표를 받은 시각(epoch ms). */
  at: number;
}

export interface CurrentPositionState {
  position: CurrentPosition | null;
  /** 아직 첫 좌표를 못 받았고 에러도 없는 상태. */
  loading: boolean;
  /** 사용자에게 보여줄 실패 문구(권한 거부·미지원·시간초과). 없으면 null. */
  error: string | null;
}

const OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10_000,
  // 도보 이동이라 오래된 좌표는 쓸모가 없다 — 30초까지만 재사용.
  maximumAge: 30_000,
};

function messageFor(err: GeolocationPositionError): string {
  if (err.code === err.PERMISSION_DENIED) {
    return "위치 권한이 거부되었습니다. 브라우저 설정에서 허용하거나 출발지를 직접 지정하세요.";
  }
  if (err.code === err.POSITION_UNAVAILABLE) {
    return "현재 위치를 확인할 수 없습니다.";
  }
  return "위치 확인이 지연되고 있습니다.";
}

/** geolocation 지원 여부는 기기 특성이라 구독이 필요 없다(빈 subscribe). */
const noSubscribe = () => () => {};
const readSupport = () =>
  typeof navigator !== "undefined" && "geolocation" in navigator;
// 서버 스냅샷은 '지원함'으로 둔다 — SSR에서 잠깐 에러 문구가 번쩍이지 않도록.
const serverSupport = () => true;

export function useCurrentPosition({
  enabled = true,
  watch = false,
}: { enabled?: boolean; watch?: boolean } = {}): CurrentPositionState {
  const [position, setPosition] = React.useState<CurrentPosition | null>(null);
  const [failure, setFailure] = React.useState<string | null>(null);
  // effect 안에서 동기 setState를 하지 않으려고(react-hooks/set-state-in-effect)
  // 지원 여부는 상태가 아니라 외부 소스 읽기로 처리한다.
  const supported = React.useSyncExternalStore(
    noSubscribe,
    readSupport,
    serverSupport,
  );

  React.useEffect(() => {
    if (!enabled || !supported) return;

    let cancelled = false;
    const onOk = (pos: GeolocationPosition) => {
      if (cancelled) return;
      setPosition({
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        at: pos.timestamp,
      });
      setFailure(null);
    };
    const onErr = (err: GeolocationPositionError) => {
      if (cancelled) return;
      setFailure(messageFor(err));
    };

    if (watch) {
      const id = navigator.geolocation.watchPosition(onOk, onErr, OPTIONS);
      return () => {
        cancelled = true;
        navigator.geolocation.clearWatch(id);
      };
    }
    navigator.geolocation.getCurrentPosition(onOk, onErr, OPTIONS);
    return () => {
      cancelled = true;
    };
  }, [enabled, watch, supported]);

  // 미지원은 파생 문구로 — 상태로 들고 있지 않는다.
  const error = supported
    ? failure
    : "이 브라우저는 위치 정보를 지원하지 않습니다.";
  const loading = enabled && position === null && error === null;
  return { position, loading, error };
}

export default useCurrentPosition;
