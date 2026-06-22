/**
 * upcoming widget — config shape ("다가오는 내 일정").
 *
 *  사용자가 직접 입력하는 심플한 일정 목록. 각 이벤트는 날짜(필수)·제목(필수)에
 *  시간·장소·이모지(선택)를 더한다. 데이터는 config(jsonb)에만 저장되고, 표시
 *  시점에 "오늘 이후 · 가까운 순"으로 정렬·필터링한다. dataMode: 'static'.
 */

export interface ScheduleEvent {
  /** Stable id (list keys + reorder). */
  id: string;
  /** 일정 제목 (필수). 예: "주말 북한산 등산크루". */
  title: string;
  /** 날짜 ISO "yyyy-MM-dd" (필수). */
  date: string;
  /** 시간 "HH:mm" 24시간 (선택). 비우면 시간 미표시. */
  time?: string;
  /** 장소 (선택). 예: "북한산 우이역". */
  place?: string;
  /** 이모지 한 글자 (선택). 예: "🥾". */
  emoji?: string;
}

export interface UpcomingConfig {
  events: ScheduleEvent[];
}

export const DEFAULT_UPCOMING_CONFIG: UpcomingConfig = {
  events: [
    {
      id: "sample-hike",
      title: "주말 북한산 등산크루",
      date: "2026-06-27",
      time: "09:00",
      place: "북한산 우이역",
      emoji: "🥾",
    },
    {
      id: "sample-exhibit",
      title: "전시 같이 보러가요",
      date: "2026-06-28",
      time: "15:00",
      place: "예술의전당",
      emoji: "🎟️",
    },
  ],
};

/** 입력 편의를 위한 자주 쓰는 이모지 빠른 선택. */
export const QUICK_EMOJIS = [
  "🗓️",
  "🥾",
  "🎟️",
  "🍽️",
  "✈️",
  "🎂",
  "💼",
  "☕",
  "🎉",
  "🏥",
] as const;
