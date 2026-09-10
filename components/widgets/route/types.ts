/**
 * route(길찾기) — config 형태.
 *
 *  저장 위치는 `pb_widgets.config`(jsonb) 하나뿐이다 — 새 테이블·마이그레이션 없음.
 *  경로·고도 같은 조회 결과는 config에 **저장하지 않는다**(서버가 캐시한다).
 *
 *  dataMode: 'poll'이지만 주기는 24시간이다 — 도보 경로는 하루 단위로 바뀌지 않고,
 *  실제 갱신은 목적지 변경·수동 새로고침으로 일어난다(계획서 §3 "경로는 한 번만 부른다").
 */

import type { RoutePurpose } from "@/lib/widgets/route/purpose";

/** 출발·도착 지점(LocationPicker의 LocationValue와 같은 모양). */
export interface RoutePlace {
  label: string;
  lat: number;
  lon: number;
}

export interface RouteConfig {
  /** 출발지. **null이면 현재 위치**(기본값) — 기기 GPS로 매번 해석한다. */
  start: RoutePlace | null;
  /** 도착지. null이면 아직 미설정(위젯이 설정 안내를 띄운다). */
  end: RoutePlace | null;
  /**
   * 경유지(순서대로 들른다). **최대 5개** — TMAP이 6개부터 400을 준다(실측).
   * 지도를 눌러 추가하거나 검색으로 고른다.
   */
  via?: RoutePlace[];
  /**
   * 이동 목적. 없으면 일반(구버전 위젯). 등산·강변은 티맵 옵션을 스스로 정하고
   * 결과를 그 목적에 맞게 읽어 준다 — `lib/widgets/route/purpose.ts` 주석 참고.
   */
  purpose?: RoutePurpose;
  /** 계단을 피하는 경로로 탐색(TMAP searchOption 30). 목적이 일반일 때만 쓰인다. */
  avoidStairs: boolean;
}

export const DEFAULT_ROUTE_CONFIG: RouteConfig = {
  start: null,
  end: null,
  via: [],
  purpose: "walk",
  avoidStairs: false,
};

/** 경유지 최대 개수(TMAP 상한). 클라이언트도 같은 값으로 막아 400을 미리 피한다. */
export const MAX_VIA = 5;
