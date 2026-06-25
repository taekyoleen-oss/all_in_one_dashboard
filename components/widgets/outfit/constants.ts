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

/** 시간대 자동 추적('지금') 선택 id — 현재 시각이 속한 구간을 따라간다. */
export const AUTO_PERIOD_ID = "auto";

/** 주어진 시각(보통 현재)이 속한 시간대 id. */
export function currentPeriodId(date: Date): string {
  return OUTFIT_PERIODS[getOutfitPeriodIndex(date.getHours())].id;
}

/**
 * 시간대 슬롯 — 특정 날(오늘/내일)의 한 구간. '현재→미래' 롤링 윈도우의 한 칩.
 * 선택 키(=저장값)는 오늘이면 baseId('h10_12'), 내일이면 `${baseId}@1`로 인코딩한다.
 */
export interface PeriodSlot {
  /** 선택 키(저장값·하이라이트 식별자). */
  key: string;
  /** 기준 시간대 id(OUTFIT_PERIODS). */
  baseId: string;
  /** 0=오늘, 1=내일. */
  dayOffset: number;
  /** 대표 시각(예보 매칭용). */
  repHour: number;
  /** 칩 라벨(시각만, '내일' 접두는 picker가 구분선으로 표시). */
  label: string;
  emoji: string;
}

/** 선택 키를 baseId + dayOffset로 분해(레거시 오늘 키는 dayOffset 0). */
export function parsePeriodKey(key: string): { baseId: string; dayOffset: number } {
  const m = key.match(/^(.+?)@(\d+)$/);
  if (m) return { baseId: m[1], dayOffset: Number(m[2]) };
  return { baseId: key, dayOffset: 0 };
}

/**
 * 현재 시각 기준 '앞으로' 진행하는 시간대 슬롯 목록.
 *  - 오늘은 현재 구간부터 끝까지, 이어서 내일 구간들을 붙인다.
 *  - 예보 보관 한도(기본 47h ≤ HOURLY_KEEP) 안에 드는 슬롯만 포함 → 데이터 없는 칩 방지.
 * 결과적으로 지나간 시간대는 사라지고, 오후가 되면 내일 시간대가 자연히 따라온다(요구).
 */
export function buildForwardPeriods(now: Date, horizonHours = 47): PeriodSlot[] {
  const curIdx = getOutfitPeriodIndex(now.getHours());
  const limit = now.getTime() + horizonHours * 3_600_000;
  const slots: PeriodSlot[] = [];
  const addDay = (dayOffset: number, fromIdx: number) => {
    for (let i = fromIdx; i < OUTFIT_PERIODS.length; i++) {
      const p = OUTFIT_PERIODS[i];
      // 해당 슬롯의 대표 시각(오늘/내일 repHour). 미래 한도를 넘으면 그 날은 종료.
      const target = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + dayOffset,
        p.repHour,
        0,
        0,
        0,
      );
      if (target.getTime() > limit) return;
      slots.push({
        key: dayOffset === 0 ? p.id : `${p.id}@${dayOffset}`,
        baseId: p.id,
        dayOffset,
        repHour: p.repHour,
        label: p.label,
        emoji: p.emoji,
      });
    }
  };
  addDay(0, curIdx); // 오늘: 현재 구간 ~ 끝
  addDay(1, 0); // 내일: 전 구간(한도 내)
  return slots;
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
