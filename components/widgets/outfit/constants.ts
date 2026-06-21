/**
 * 외출옷 추천 위젯 — 선택 옵션 상수 (활동·시간대·체감 보정).
 *
 *  활동 목록·기본값은 원본 ActivitySelector와 동일(8종, 기본 urban_walk=산책).
 *  시간대는 원본 OUTFIT_PERIODS(7구간)와 동일.
 */

import type { ActivityType } from "./illustration/types";

/** 선택 가능한 활동 (원본 ActivitySelector ACTIVITIES와 동일). */
export const ACTIVITIES: { id: ActivityType; label: string; icon: string }[] = [
  { id: "urban_walk", label: "산책", icon: "🏙️" },
  { id: "picnic", label: "소풍", icon: "🧺" },
  { id: "river", label: "강변", icon: "🌊" },
  { id: "beach", label: "해변", icon: "🏖️" },
  { id: "running", label: "달리기", icon: "🏃" },
  { id: "cycling", label: "자전거", icon: "🚴" },
  { id: "hiking", label: "등산", icon: "🏔️" },
  { id: "golf", label: "골프", icon: "⛳" },
];

/** 기본 활동 — 산책(일반 외출). */
export const DEFAULT_ACTIVITY: ActivityType = "urban_walk";

export function activityLabel(id: ActivityType): string {
  return ACTIVITIES.find((a) => a.id === id)?.label ?? "산책";
}

export function activityIcon(id: ActivityType): string {
  return ACTIVITIES.find((a) => a.id === id)?.icon ?? "🏙️";
}

/** 시간대 (원본 OUTFIT_PERIODS — 7구간). */
export interface OutfitPeriod {
  id: string;
  label: string;
  emoji: string;
  repHour: number;
  start: number;
  end: number;
}

export const OUTFIT_PERIODS: OutfitPeriod[] = [
  { id: "dawn", label: "새벽", emoji: "🌙", repHour: 3, start: 0, end: 6 },
  { id: "h07_09", label: "7~9시", emoji: "🌅", repHour: 8, start: 7, end: 9 },
  { id: "h10_12", label: "10~12시", emoji: "☀️", repHour: 11, start: 10, end: 12 },
  { id: "h13_15", label: "13~15시", emoji: "🌤", repHour: 14, start: 13, end: 15 },
  { id: "h16_18", label: "16~18시", emoji: "🌇", repHour: 17, start: 16, end: 18 },
  { id: "h19_21", label: "19~21시", emoji: "🌆", repHour: 20, start: 19, end: 21 },
  { id: "h21_23", label: "21~23시", emoji: "🌙", repHour: 22, start: 21, end: 23 },
];

export function getOutfitPeriodIndex(hour: number): number {
  if (hour < 7) return 0;
  if (hour < 10) return 1;
  if (hour < 13) return 2;
  if (hour < 16) return 3;
  if (hour < 19) return 4;
  if (hour < 22) return 5;
  return 6;
}

export function periodById(id: string): OutfitPeriod {
  return OUTFIT_PERIODS.find((p) => p.id === id) ?? OUTFIT_PERIODS[2];
}

/**
 * 체감 보정 — 개인 추위/더위 민감도(°C). 효과 체감온도에 더해 추천 구간을 옮긴다.
 * 추위를 많이 타면 음수(체감을 더 춥게 → 더 따뜻한 추천), 더위를 많이 타면 양수.
 */
export interface SensitivityOption {
  id: string;
  label: string;
  offset: number;
}

export const SENSITIVITY_OPTIONS: SensitivityOption[] = [
  { id: "cold-much", label: "추위 많이 탐", offset: -3 },
  { id: "cold", label: "추위 조금 탐", offset: -1.5 },
  { id: "normal", label: "보통", offset: 0 },
  { id: "heat", label: "더위 조금 탐", offset: 1.5 },
  { id: "heat-much", label: "더위 많이 탐", offset: 3 },
];

export const DEFAULT_SENSITIVITY = "normal";

export function sensitivityOffset(id: string): number {
  return SENSITIVITY_OPTIONS.find((s) => s.id === id)?.offset ?? 0;
}
