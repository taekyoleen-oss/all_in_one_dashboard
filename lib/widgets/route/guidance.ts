/**
 * ============================================================================
 *  길찾기 — 다음 안내 선택 (순수 로직, 부수효과 없음)
 * ============================================================================
 *
 *  "현재 위치에서 몇 미터 앞에 어느 방향으로"(요구 2)를 만드는 계산.
 *
 *  경로를 다시 부르지 않는다 — 이미 받아둔 `steps`(각 안내 지점의 출발지로부터
 *  누적 거리)와 현재 위치를 폴리라인에 투영한 거리만으로 정한다. 그래서 GPS가
 *  갱신될 때마다 계산만 다시 하면 되고 TMAP 호출은 늘지 않는다.
 *
 *  ⚠ 틀려도 크래시가 아니라 **엉뚱한 방향 안내**로 나타나는 종류의 로직이라
 *  guidance.test.ts가 경계(출발 직전·안내점 위·도착 근처·경로 끝 너머)를 고정한다.
 */

import type { WalkStep } from "@/output/api-shapes";

/** 도착지에서 이 거리(m) 안이면 '도착'으로 본다. */
export const ARRIVE_WITHIN_M = 20;

/**
 * TMAP turnType → 짧은 방향 라벨.
 *
 * 표시 문구의 본체는 서버가 준 `description`이고, 이 표는 **큰 글씨 한 줄**과
 * 아이콘 선택에만 쓴다. 모르는 코드는 null → 호출부가 description으로 폴백하므로
 * 표가 불완전해도 안내가 죽지 않는다(공식 코드표 기준).
 */
const TURN_LABELS: Record<number, string> = {
  11: "직진",
  12: "좌회전",
  13: "우회전",
  14: "유턴",
  16: "8시 방향 좌회전",
  17: "10시 방향 좌회전",
  18: "2시 방향 우회전",
  19: "4시 방향 우회전",
  125: "육교",
  126: "지하보도",
  127: "계단",
  128: "경사로",
  129: "계단·경사로",
  184: "경유지",
  200: "출발",
  201: "도착",
  211: "횡단보도",
  212: "좌측 횡단보도",
  213: "우측 횡단보도",
  214: "8시 방향 횡단보도",
  215: "10시 방향 횡단보도",
  216: "2시 방향 우측 횡단보도",
  217: "4시 방향 횡단보도",
  218: "엘리베이터",
  233: "직진",
};

/** 짧은 방향 라벨. 모르는 코드면 null. */
export function turnLabel(turnType: number): string | null {
  return TURN_LABELS[turnType] ?? null;
}

export interface Guidance {
  /** 다음에 할 행동이 있는 안내 지점. 도착만 남았으면 null. */
  step: WalkStep | null;
  /** 그 지점까지 남은 **경로상** 거리(m). step이 null이면 0. */
  toStep: number;
  /** 도착지까지 남은 거리(m). */
  toEnd: number;
  /** 도착 판정(도착지 20m 이내). */
  arrived: boolean;
}

/**
 * 현재 경로상 위치에서 '다음 안내'를 고른다.
 *
 * @param steps          경로의 안내 지점(서버가 준 순서 = 누적 거리 오름차순)
 * @param distanceAlong  현재 위치를 폴리라인에 투영한 누적 거리(m)
 * @param totalDistance  경로 총 거리(m)
 */
export function nextGuidance(
  steps: readonly WalkStep[],
  distanceAlong: number,
  totalDistance: number,
): Guidance {
  const along = Number.isFinite(distanceAlong)
    ? Math.max(0, Math.min(distanceAlong, totalDistance))
    : 0;
  const toEnd = Math.max(0, totalDistance - along);
  const arrived = toEnd <= ARRIVE_WITHIN_M;

  if (arrived) return { step: null, toStep: 0, toEnd, arrived: true };

  // 출발지(SP)는 뒤에 있고 도착지(EP)는 toEnd가 이미 말해주므로 안내로 삼지 않는다.
  // 남는 것은 실제로 '무언가를 해야 하는' 지점들뿐이다.
  const next = steps.find(
    (s) =>
      s.pointType !== "SP" &&
      s.pointType !== "EP" &&
      s.distanceFromStart >= along,
  );

  if (!next) return { step: null, toStep: 0, toEnd, arrived: false };
  return {
    step: next,
    toStep: Math.max(0, next.distanceFromStart - along),
    toEnd,
    arrived: false,
  };
}
