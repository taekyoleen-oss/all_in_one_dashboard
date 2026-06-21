/**
 * 외출옷 추천 위젯 — config 형태.
 *
 *  위치(label+lat/lon) + 개인 설정(성별·활동·체감 보정)을 저장한다. 날씨 데이터는
 *  config에 두지 않고 /api/weather에서 폴링한다(날씨 위젯과 동일 패턴, dataMode:'poll').
 *  기본 시간대는 config에 보관하되, 타일/전체에서 즉시 바꿀 수 있다(로컬 상태).
 */

import type { ActivityType, GenderType } from "./illustration/types";

export interface OutfitConfig {
  /** 위치 표시 이름 (예: "서울", "역삼동"). */
  label: string;
  /** 위도 (-90..90). */
  lat: number;
  /** 경도 (-180..180). */
  lon: number;
  /** 성별 — 추천 실루엣·액세서리에 반영. */
  gender: GenderType;
  /** 활동 — 기본 '산책'(urban_walk). */
  activity: ActivityType;
  /** 체감 보정(추위/더위 민감도) 옵션 id (constants.SENSITIVITY_OPTIONS). */
  sensitivity: string;
  /** 기본 시간대 id (constants.OUTFIT_PERIODS). 비우면 현재 시각 구간. */
  periodId?: string;
}

/** 기본 설정: 서울 시청 · 남성 · 산책 · 보통 체감. */
export const DEFAULT_OUTFIT_CONFIG: OutfitConfig = {
  label: "서울",
  lat: 37.5665,
  lon: 126.978,
  gender: "male",
  activity: "urban_walk",
  sensitivity: "normal",
};
