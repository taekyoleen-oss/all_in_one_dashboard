"use client";

/**
 * useCurrentPosition — 기기 GPS 위치 (+ 마지막으로 알려진 위치 폴백).
 *
 *  출발지가 '현재 위치'(config.start === null)일 때 출발 좌표를 얻고, 전체보기에서는
 *  `watch: true`로 이동을 따라간다(요구 2의 "현재 위치에서 몇 미터 앞").
 *
 *  ── 위치를 못 잡으면 마지막 위치를 쓴다 ───────────────────────────────────
 *  실내·지하·권한 지연으로 GPS가 안 잡히는 일은 흔하다. 그때마다 위젯이 빈 화면이
 *  되면 쓸모가 없으므로, 마지막으로 성공한 좌표(localStorage `pb:lastPosition`)를
 *  대신 내보낸다. **다만 `stale: true`로 반드시 표시한다** — 옛 위치를 현재인 척
 *  하면 엉뚱한 경로를 자신 있게 안내하게 된다.
 *
 *  구독은 effect 안에서만 만든다(React 19 안전 패턴 — 렌더 중 setState 없음).
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
  /** true면 지금 잡은 값이 아니라 **마지막으로 저장된** 위치다. */
  stale: boolean;
}

export interface CurrentPositionState {
  position: CurrentPosition | null;
  /** 아직 아무 좌표도(마지막 위치조차) 없고 에러도 없는 상태. */
  loading: boolean;
  /** 사용자에게 보여줄 실패 문구(권한 거부·미지원·시간초과). 없으면 null. */
  error: string | null;
}

const STORAGE_KEY = "pb:lastPosition";

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

/** 마지막으로 성공한 좌표. 없거나 깨졌으면 null. */
function loadLastPosition(): CurrentPosition | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p: unknown = JSON.parse(raw);
    if (typeof p !== "object" || p === null) return null;
    const { lat, lon, accuracy, at } = p as Record<string, unknown>;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return {
      lat: lat as number,
      lon: lon as number,
      accuracy: Number.isFinite(accuracy) ? (accuracy as number) : 100,
      at: Number.isFinite(at) ? (at as number) : 0,
      stale: true,
    };
  } catch {
    return null;
  }
}

function saveLastPosition(p: CurrentPosition): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ lat: p.lat, lon: p.lon, accuracy: p.accuracy, at: p.at }),
    );
  } catch {
    /* 저장 실패해도 이번 세션 동작에는 영향이 없다 */
  }
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
  // 마지막 위치는 마운트 시 한 번만 읽는다(localStorage는 렌더마다 읽을 값이 아니다).
  // 지연 초기화라 SSR에서는 실행되지 않는다.
  const [lastKnown] = React.useState<CurrentPosition | null>(loadLastPosition);
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
      const next: CurrentPosition = {
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        at: pos.timestamp,
        stale: false,
      };
      setPosition(next);
      setFailure(null);
      saveLastPosition(next);
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
  const unsupported = supported
    ? null
    : "이 브라우저는 위치 정보를 지원하지 않습니다.";
  const failed = unsupported ?? failure;

  // 생 좌표가 없으면 마지막 위치로 버틴다(stale 표시는 그대로 유지된다).
  const effective = position ?? lastKnown;
  // 마지막 위치라도 있으면 '실패'로 화면을 덮지 않는다 — 대신 호출부가 stale 배지를
  // 띄운다. 아무것도 없을 때만 에러를 표면화한다.
  const error = effective ? null : failed;
  const loading = enabled && effective === null && failed === null;

  return { position: effective, loading, error };
}

export default useCurrentPosition;
