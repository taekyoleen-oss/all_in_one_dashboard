/**
 * dday · countdown computation (date-fns).
 *
 *  Returns the whole-day delta to the target and a "D-12" / "D+3" / "D-Day"
 *  label. For repeat-yearly entries the target is rolled forward to the next
 *  occurrence (this year's anniversary, or next year's if already passed).
 */

import {
  differenceInCalendarDays,
  parseISO,
  isValid,
  startOfDay,
  setYear,
  getYear,
  isBefore,
  addYears,
  format,
} from "date-fns";
import type { DDayEntry } from "./types";

export interface DDayReadout {
  /** Whole calendar days from today to the (effective) target. */
  days: number;
  /** "D-12" (future) / "D+3" (past) / "D-Day" (today). */
  label: string;
  /** Direction for color/symbol pairing — never color alone. */
  tone: "future" | "today" | "past";
  /** The effective target date (after yearly roll-forward), formatted. */
  targetText: string;
  /** True when the entry's date string failed to parse. */
  invalid: boolean;
}

/**
 * Compute the readout for one entry relative to `now` (defaults to the live
 * wall-clock day). Pure + deterministic given (entry, now).
 */
export function computeDDay(entry: DDayEntry, now: Date = new Date()): DDayReadout {
  const parsed = parseISO(entry.date);
  if (!isValid(parsed)) {
    return {
      days: 0,
      label: "—",
      tone: "today",
      targetText: entry.date || "날짜 없음",
      invalid: true,
    };
  }

  const today = startOfDay(now);
  let target = startOfDay(parsed);

  if (entry.repeatYearly) {
    // Roll the anniversary to this year; if it already passed, use next year.
    target = setYear(target, getYear(today));
    if (isBefore(target, today)) target = addYears(target, 1);
  }

  const days = differenceInCalendarDays(target, today);
  const tone: DDayReadout["tone"] = days > 0 ? "future" : days < 0 ? "past" : "today";
  const label =
    days === 0 ? "D-Day" : days > 0 ? `D-${days}` : `D+${Math.abs(days)}`;

  return {
    days,
    label,
    tone,
    targetText: format(target, "yyyy.MM.dd"),
    invalid: false,
  };
}
