/**
 * ============================================================================
 *  길찾기 — 고도 그래프의 표시 범위 계산 (순수 로직)
 * ============================================================================
 *
 *  그래프를 실제 최저~최고에 꽉 맞추면 **3m짜리 굴곡도 산처럼 보인다.** 평지에
 *  가까운 길에 큰 고도차가 있는 것처럼 표시하지 않으려면 세로 축의 폭에 하한이
 *  필요하다.
 *
 *    • 표시 폭(span)은 `MIN_DISPLAY_SPAN_M` 아래로 좁아지지 않는다. 실제 고저차가
 *      그보다 작으면 남는 여백이 위아래로 고르게 붙어 선이 **가운데에 평평하게**
 *      깔린다.
 *    • 고저차가 `FLAT_THRESHOLD_M` 미만이면 '거의 평지'로 본다. 이때는 누적 상승도
 *      알리지 않는다 — 90m 해상도 DEM의 잔떨림이 몇십 m로 합산돼 실제보다 험한
 *      길처럼 보이기 때문이다.
 *
 *  고저차가 하한보다 크면 종전과 똑같이 동작한다(범위 = 실제 최저~최고).
 */

import type { WalkElevationPoint } from "@/output/api-shapes";

/**
 * 세로 축이 이보다 좁아지지 않는다(m). 작은 굴곡의 과장을 막는 하한.
 *
 * 40m로 잡은 근거(실측): 하한 20m에서는 고저차 9m짜리 평지 산책로(석촌호수)가
 * 여전히 차트 높이의 40%를 차지해 오르막처럼 보였다. 40m면 같은 경로가 약 20%로
 * 내려가 평평하게 읽히고, 도심 언덕(고저차 30m 안팎)은 여전히 형태가 드러난다.
 */
export const MIN_DISPLAY_SPAN_M = 40;

/** 이 미만의 고저차는 '거의 평지'로 표시한다(m). */
export const FLAT_THRESHOLD_M = 10;

export interface ElevationDomain {
  /** 실제 최저 고도(m). */
  min: number;
  /** 실제 최고 고도(m). */
  max: number;
  /** 실제 고저차(m). */
  range: number;
  /** 그래프 세로 축의 아래끝(m) — min보다 낮을 수 있다(여백). */
  domainMin: number;
  /** 그래프 세로 축의 폭(m). 항상 MIN_DISPLAY_SPAN_M 이상. */
  span: number;
  /** 거의 평지인가(range < FLAT_THRESHOLD_M). */
  flat: boolean;
  /** 누적 상승(m). 평지면 0으로 보고하지 않고 그대로 두되 UI가 감춘다. */
  gain: number;
}

/** 빈/1점 입력에서도 안전한 기본값. */
const EMPTY: ElevationDomain = {
  min: 0,
  max: 0,
  range: 0,
  domainMin: -MIN_DISPLAY_SPAN_M / 2,
  span: MIN_DISPLAY_SPAN_M,
  flat: true,
  gain: 0,
};

export function elevationDomain(
  points: ReadonlyArray<WalkElevationPoint>,
): ElevationDomain {
  const values = points
    .map((p) => p.elevation)
    .filter((e) => Number.isFinite(e));
  if (values.length === 0) return EMPTY;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;

  let gain = 0;
  for (let i = 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    if (d > 0) gain += d;
  }

  // 실제 고저차가 하한보다 작으면 가운데 정렬로 여백을 채운다.
  const span = Math.max(range, MIN_DISPLAY_SPAN_M);
  const mid = (min + max) / 2;
  const domainMin = mid - span / 2;

  return {
    min,
    max,
    range,
    domainMin,
    span,
    flat: range < FLAT_THRESHOLD_M,
    gain: Math.round(gain),
  };
}

/** 고도값 → 0(위)~1(아래) 사이의 세로 비율. 그래프·라벨이 같은 값을 쓴다. */
export function elevationRatio(
  elevation: number,
  domain: ElevationDomain,
): number {
  return 1 - (elevation - domain.domainMin) / domain.span;
}
