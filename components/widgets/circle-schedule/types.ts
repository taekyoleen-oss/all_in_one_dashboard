/**
 * circle-schedule — "지인 일정 정리" 위젯 config.
 *
 *  실제 데이터(대상·약속)는 Supabase(pb_circle_targets / pb_circle_appointments)에
 *  사용자별 RLS로 저장되므로, config에는 뷰 상태만 둔다. `filter`는 선택된 대상(구분)
 *  필터로, 타일↔전체가 공유하고 리로드에도 유지된다(useSaveWidgetConfig).
 *
 *  dataMode: 'static'(온디맨드 LLM). copyBehavior: 'config'. sensitive: true.
 */

export interface CircleScheduleConfig {
  /** 선택된 대상(구분) id. "unassigned"=미지정만, 없음/"all"=전체. */
  filter?: string;
}

export const DEFAULT_CIRCLE_SCHEDULE_CONFIG: CircleScheduleConfig = {};

/** 전체 보기 필터 키. */
export const FILTER_ALL = "all";
/** 미지정(대상 없는 약속)만 보기 필터 키. */
export const FILTER_UNASSIGNED = "unassigned";

/** 새 구분 생성 시 돌아가며 제안할 파스텔 색(대상 배지). */
export const TARGET_COLORS = [
  "#0891B2", // cyan
  "#7C3AED", // violet
  "#DB2777", // pink
  "#059669", // emerald
  "#D97706", // amber
  "#DC2626", // red
  "#2563EB", // blue
  "#65A30D", // lime
];

/** 시드용 기본 구분(최초 1회, 대상이 하나도 없을 때 제안). */
export const SEED_TARGETS: Array<{ name: string; color: string }> = [
  { name: "가족", color: "#0891B2" },
  { name: "친구", color: "#DB2777" },
];
