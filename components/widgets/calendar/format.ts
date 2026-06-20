/**
 * calendar widget — date/time formatting + grouping helpers (설계서 §2.2).
 *
 *  All event times arrive as epoch ms (normalized server-side). These helpers
 *  turn them into Korean-locale labels and a relative "day bucket" so the agenda
 *  reads without relying on color. All-day events show a date-only label.
 */

import type { CalendarEvent } from "@/output/api-shapes";

/** Start-of-day (local) epoch ms for a given time. */
function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Whole-day difference (local) from today: 0 = today, 1 = tomorrow, … */
export function dayOffset(ms: number, now: number = Date.now()): number {
  const a = startOfDay(now);
  const b = startOfDay(ms);
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

/** A short relative day label: 오늘 / 내일 / 모레 / "6월 24일 (화)". */
export function dayLabel(ms: number, now: number = Date.now()): string {
  const off = dayOffset(ms, now);
  if (off === 0) return "오늘";
  if (off === 1) return "내일";
  if (off === 2) return "모레";
  return new Date(ms).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

/** Clock label "오후 2:30" for a timed event. */
export function timeLabel(ms: number): string {
  return new Date(ms).toLocaleTimeString("ko-KR", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * The time portion shown on an event row:
 *  - all-day → "종일"
 *  - timed   → "오후 2:30"
 */
export function eventTimeLabel(ev: CalendarEvent): string {
  return ev.allDay ? "종일" : timeLabel(ev.start);
}

/** A compact "오늘 · 오후 2:30" one-liner (when day + time both fit one line). */
export function eventWhenLabel(ev: CalendarEvent, now: number = Date.now()): string {
  const day = dayLabel(ev.start, now);
  return ev.allDay ? `${day} · 종일` : `${day} · ${timeLabel(ev.start)}`;
}

/** A group of events sharing one calendar day, for the agenda view. */
export interface CalendarDayGroup {
  /** start-of-day epoch ms (the group key). */
  dayMs: number;
  /** Relative day heading (오늘 / 내일 / "6월 24일 (화)"). */
  label: string;
  events: CalendarEvent[];
}

/**
 * Group a time-ordered event list into per-day buckets (already sorted soonest
 * first by the server). Stable: preserves the incoming order within each day.
 */
export function groupByDay(
  events: CalendarEvent[],
  now: number = Date.now(),
): CalendarDayGroup[] {
  const groups: CalendarDayGroup[] = [];
  const index = new Map<number, CalendarDayGroup>();
  for (const ev of events) {
    const dayMs = startOfDay(ev.start);
    let g = index.get(dayMs);
    if (!g) {
      g = { dayMs, label: dayLabel(ev.start, now), events: [] };
      index.set(dayMs, g);
      groups.push(g);
    }
    g.events.push(ev);
  }
  return groups;
}
