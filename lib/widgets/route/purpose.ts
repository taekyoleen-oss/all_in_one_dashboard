/**
 * ============================================================================
 *  길찾기 — 이동 목적(일반·등산·강변/해변) 프리셋 (순수 로직)
 * ============================================================================
 *
 *  ⚠ 먼저 밝혀 둘 사실: **티맵 보행자 경로에는 '등산 모드'가 없다.**
 *    요청으로 줄 수 있는 경로 옵션은 `searchOption` 네 값뿐이고
 *    (0 추천 / 4 추천+대로우선 / 10 최단 / 30 최단+계단제외),
 *    그 밖의 값은 전부 400으로 거절된다(1·2·3·20·31·99 실측).
 *    `routeOption`·`theme` 같은 이름을 지어 보내면 조용히 무시된다
 *    (거리가 1m도 바뀌지 않는다 — 실측).
 *
 *  그래서 여기서 하는 일은 "산길 전용 API를 부르는 것"이 아니라, **네 옵션 중
 *  그 목적에 실제로 유리한 것을 고르고, 나온 결과를 목적에 맞게 읽어 주는 것**
 *  이다. 고른 근거는 전부 실측이다
 *  (등산: 이태원역→N서울타워 / 강변: 반포한강공원→잠원한강공원):
 *
 *    등산  so=0   2,968m  산책로 832m  최고 268m  ← 채택
 *          so=4   4,465m  산책로 429m             대로를 우선하느라 산을 감아 돌아
 *                                                 1.5km(+50%)를 더 걷는다
 *          so=10  2,844m  산책로 437m             조금 짧지만 산책로가 절반으로 준다
 *          so=30  3,303m  산책로 832m  최고 270m  계단을 피해도 **같은 정상에 오르고**
 *                                                 거리만 335m(+11%) 늘어난다
 *    강변  so=30  2,862m  계단 0  ← 채택 (제방 계단을 피해 물가 평지를 유지)
 *          so=0   2,929m  계단 28m
 *          so=10  2,675m  교량으로 건너뛰어 물가에서 멀어진다
 *
 *  ⚠ 위 표에 누적 상승을 쓰지 않은 이유: 90m DEM을 경로마다 100점으로 표본하면
 *    **긴 경로일수록 표본이 성글어져 잔떨림이 덜 쌓인다.** 같은 남산 경로를
 *    세 방식으로 재니 so=0은 342~371m, so=30은 343~384m로 나와 순서까지 뒤집혔다
 *    (표본 간격을 25m로 맞추면 354 vs 382). 두 경로의 차이는 그 노이즈 폭 안이라
 *    상승량으로는 우열을 가릴 수 없다 — 그래서 판단은 티맵이 직접 준 값
 *    (거리·산책로 길이·계단 유무)에만 기댄다.
 *
 *  두 번째 몫은 **시간**이다. 티맵의 소요시간은 평지 보행 속도 기준이라 산에서는
 *  크게 빗나간다(위 남산 경로를 40분이라고 한다 — 실제로는 한 시간이 넘는다).
 *  등산일 때만 네이스미스 규칙으로 오르막 몫을 더한다.
 */

/** 이동 목적. 저장값이라 문자열을 바꾸면 기존 위젯이 깨진다. */
export type RoutePurpose = "walk" | "hike" | "waterside";

export interface PurposePreset {
  key: RoutePurpose;
  /** 선택 UI에 쓰는 짧은 이름. */
  label: string;
  /** 무엇이 달라지는지 한 줄로 — 버튼 title. */
  hint: string;
  /**
   * 이 목적이 강제하는 TMAP searchOption.
   * null이면 목적이 정하지 않는다는 뜻 → '계단 피하기' 설정을 따른다.
   */
  searchOption: "0" | "30" | null;
  /** 결과 요약에 덧붙일 한마디(없으면 표시하지 않는다). */
  note: string | null;
  /** 오르막 소요시간 보정을 적용하는가. */
  slopeTime: boolean;
}

export const PURPOSES: readonly PurposePreset[] = [
  {
    key: "walk",
    label: "일반",
    hint: "티맵 추천 보행 경로",
    searchOption: null,
    note: null,
    slopeTime: false,
  },
  {
    key: "hike",
    label: "등산",
    hint: "산책로를 살립니다. 계단 회피는 끕니다 — 같은 정상에 오르면서 거리만 늘어납니다",
    // 추천(0). 대로 우선은 산을 감아 돌고(+50%), 계단 제외는 같은 정상에
    // 오르면서 거리만 늘린다(+11%). 실측 근거는 파일 머리말.
    searchOption: "0",
    note: "산길 우선",
    // 티맵 소요시간은 평지 기준이라 오르막을 더해야 실제에 가깝다.
    slopeTime: true,
  },
  {
    key: "waterside",
    label: "강변·해변",
    hint: "제방 계단을 피해 물가 평지를 유지합니다",
    // 최단 + 계단 제외. 강변길에서 계단은 대개 제방을 넘어 물가를 벗어나는 길이다.
    searchOption: "30",
    // "평지"라고 쓰지 않는다 — 산길에 이 목적을 걸어도 계단만 빠질 뿐 평지가 되지는
    // 않는다(실측: 남산에 강변을 걸면 3.3km·상승 343m). 옵션이 보장하는 사실만 말한다.
    note: "계단 없음",
    slopeTime: false,
  },
] as const;

const DEFAULT_PURPOSE: RoutePurpose = "walk";

/** 저장된 값(구버전은 없음·오타 가능)을 안전하게 프리셋으로 옮긴다. */
export function purposeOf(key: string | null | undefined): PurposePreset {
  return (
    PURPOSES.find((p) => p.key === key) ??
    PURPOSES.find((p) => p.key === DEFAULT_PURPOSE)!
  );
}

/**
 * 목적 + 계단 회피 설정 → 실제로 보낼 searchOption.
 * 목적이 옵션을 정하면 그쪽이 이긴다 — 등산에서 '계단 피하기'는 정상 높이를
 * 낮춰 주지 못하고 거리만 11% 늘리므로, 체크가 켜져 있어도 따르지 않는다.
 */
export function searchOptionFor(
  purpose: string | null | undefined,
  avoidStairs: boolean,
): "0" | "30" {
  const preset = purposeOf(purpose);
  return preset.searchOption ?? (avoidStairs ? "30" : "0");
}

/** 목적이 계단 옵션을 이미 정하는가(= '계단 피하기' 체크가 무의미한가). */
export function stairsFixedBy(purpose: string | null | undefined): boolean {
  return purposeOf(purpose).searchOption !== null;
}

/**
 * 네이스미스 규칙의 오르막 몫: 상승 600m당 1시간 = 1m당 6초.
 * (수평 이동 시간은 티맵이 이미 준 값을 그대로 쓴다.)
 */
export const CLIMB_SECONDS_PER_METER = 6;

/**
 * 오르막을 반영한 소요시간(초). 누적 상승이 없거나 목적이 등산이 아니면
 * 원래 값을 그대로 돌려준다 — 없는 정확도를 지어내지 않는다.
 */
export function slopeAdjustedTime(
  baseSeconds: number,
  gainMeters: number,
): number {
  if (!Number.isFinite(baseSeconds) || baseSeconds < 0) return 0;
  if (!Number.isFinite(gainMeters) || gainMeters <= 0) {
    return Math.round(baseSeconds);
  }
  return Math.round(baseSeconds + gainMeters * CLIMB_SECONDS_PER_METER);
}
