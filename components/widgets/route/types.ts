/**
 * route(길찾기) — config 형태.
 *
 *  저장 위치는 `pb_widgets.config`(jsonb) 하나뿐이다 — 새 테이블·마이그레이션 없음.
 *  경로·고도 같은 조회 결과는 config에 **저장하지 않는다**(서버가 캐시한다).
 *
 *  dataMode: 'poll'이지만 주기는 24시간이다 — 도보 경로는 하루 단위로 바뀌지 않고,
 *  실제 갱신은 목적지 변경·수동 새로고침으로 일어난다(계획서 §3 "경로는 한 번만 부른다").
 */

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
  /** 계단을 피하는 경로로 탐색(TMAP searchOption 30). */
  avoidStairs: boolean;
}

export const DEFAULT_ROUTE_CONFIG: RouteConfig = {
  start: null,
  end: null,
  avoidStairs: false,
};
