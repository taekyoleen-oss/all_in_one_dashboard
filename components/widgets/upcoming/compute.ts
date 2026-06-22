/**
 * upcoming · 일정 계산 (date-fns).
 *
 *  - 오늘 이후(>= 오늘)의 유효한 일정만 추려 가까운 날짜→이른 시간 순으로 정렬.
 *  - 각 일정의 D-day(D-Day / D-3), 요일(토/일), 날짜 숫자, 한국어 시간 문구를 계산.
 *  순수 함수(주어진 now에 대해 결정적) — 뷰는 useNow로 자정마다 갱신만 한다.
 */

import {
  differenceInCalendarDays,
  parseISO,
  isValid,
  startOfDay,
} from "date-fns";
import type { ScheduleEvent } from "./types";

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;

export interface EventReadout {
  event: ScheduleEvent;
  /** 오늘로부터의 일수(오늘=0, 미래>0). */
  days: number;
  /** "D-DAY" / "D-3". */
  ddayLabel: string;
  /** 오늘인지 — 배지 강조용. */
  isToday: boolean;
  /** 요일 한 글자(일~토). */
  weekday: string;
  /** 날짜 숫자(1~31). */
  day: number;
  /** "오전 9시" / "오후 3시 30분" — 시간이 없거나 형식이 틀리면 null. */
  timeText: string | null;
}

/** "09:00" → "오전 9시", "15:30" → "오후 3시 30분". 형식이 아니면 null. */
export function formatKoreanTime(time: string | undefined): string | null {
  if (!time) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) {
    return null;
  }
  const period = h < 12 ? "오전" : "오후";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return min === 0 ? `${period} ${h12}시` : `${period} ${h12}시 ${min}분`;
}

/** "오전 9시 · 북한산 우이역" — 시간/장소 중 있는 것만 ' · '로 연결(없으면 null). */
export function eventSubtitle(event: ScheduleEvent): string | null {
  const parts = [formatKoreanTime(event.time), event.place?.trim() || null].filter(
    (p): p is string => !!p,
  );
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** 한 일정의 표시값을 계산(날짜가 유효할 때만 사용; 무효 일정은 호출 전에 제외). */
function readEvent(event: ScheduleEvent, today: Date): EventReadout | null {
  const parsed = parseISO(event.date);
  if (!isValid(parsed)) return null;
  const target = startOfDay(parsed);
  const days = differenceInCalendarDays(target, today);
  return {
    event,
    days,
    ddayLabel: days === 0 ? "D-DAY" : `D-${days}`,
    isToday: days === 0,
    weekday: WEEKDAY_KO[target.getDay()],
    day: target.getDate(),
    timeText: formatKoreanTime(event.time),
  };
}

/**
 * 오늘 이후(>= 오늘)의 일정을 가까운 순(날짜↑, 같은 날은 시간↑, 그다음 입력순)으로
 * 정렬해 반환. 지난 일정·날짜 무효 일정은 제외.
 */
export function upcomingEvents(
  events: ScheduleEvent[],
  now: Date = new Date(),
): EventReadout[] {
  const today = startOfDay(now);
  const readouts: EventReadout[] = [];
  events.forEach((event, index) => {
    const r = readEvent(event, today);
    if (!r || r.days < 0) return; // 무효/지난 일정 제외
    // 안정 정렬용 인덱스를 days·time에 종속시켜 비교 (아래 sort에서 사용).
    readouts.push(Object.assign(r, { _i: index }) as EventReadout & { _i: number });
  });
  return (readouts as (EventReadout & { _i: number })[]).sort((a, b) => {
    if (a.days !== b.days) return a.days - b.days;
    const ta = a.event.time ?? "99:99";
    const tb = b.event.time ?? "99:99";
    if (ta !== tb) return ta < tb ? -1 : 1;
    return a._i - b._i;
  });
}
