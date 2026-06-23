/**
 * vehicle · derived metrics (연비·지출·만기 D-day).
 *
 *  Pure helpers over the config: latest odometer, recent fuel economy (km/L from
 *  consecutive fills), this-month fuel spend, and the next renewal reminder.
 */

import {
  parseISO,
  isValid,
  startOfDay,
  differenceInCalendarDays,
  isSameMonth,
  format,
} from "date-fns";
import type { VehicleConfig, FuelLog, Reminder } from "./types";

/** Fuel logs sorted oldest→newest by (odo, date). */
function sortedFuel(logs: FuelLog[]): FuelLog[] {
  return [...logs].sort((a, b) => a.odo - b.odo || a.date.localeCompare(b.date));
}

export interface VehicleStats {
  /** Highest odometer seen across fuel + maintenance logs (km), or null. */
  odometer: number | null;
  /** Most recent fuel economy from the last two fills (km/L), or null. */
  recentKmPerL: number | null;
  /** Average fuel economy across all usable fill intervals (km/L), or null. */
  avgKmPerL: number | null;
  /** This calendar month's fuel spend (KRW). */
  monthFuelCost: number;
  /** All-time fuel spend (KRW). */
  totalFuelCost: number;
}

export function computeStats(
  config: VehicleConfig,
  now: Date = new Date(),
): VehicleStats {
  const fuel = sortedFuel(config.fuelLogs);

  let odometer: number | null = null;
  for (const f of config.fuelLogs) odometer = Math.max(odometer ?? 0, f.odo);
  for (const m of config.maintLogs)
    if (m.odo !== undefined) odometer = Math.max(odometer ?? 0, m.odo);

  // Fuel economy: distance between fill i-1→i divided by liters added at fill i
  // (the classic "tank-to-tank" method).
  let recentKmPerL: number | null = null;
  let totalDist = 0;
  let totalLiters = 0;
  for (let i = 1; i < fuel.length; i++) {
    const dist = fuel[i].odo - fuel[i - 1].odo;
    const liters = fuel[i].liters;
    if (dist > 0 && liters > 0) {
      totalDist += dist;
      totalLiters += liters;
      recentKmPerL = dist / liters; // last valid interval wins
    }
  }
  const avgKmPerL = totalLiters > 0 ? totalDist / totalLiters : null;

  let monthFuelCost = 0;
  let totalFuelCost = 0;
  for (const f of config.fuelLogs) {
    totalFuelCost += f.cost || 0;
    const d = parseISO(f.date);
    if (isValid(d) && isSameMonth(d, now)) monthFuelCost += f.cost || 0;
  }

  return {
    odometer,
    recentKmPerL,
    avgKmPerL,
    monthFuelCost,
    totalFuelCost,
  };
}

export interface ReminderReadout {
  reminder: Reminder;
  daysUntil: number;
  text: string;
  tone: "ok" | "soon" | "overdue";
}

/** Reminders sorted by soonest, with a D-day readout. */
export function sortedReminders(
  config: VehicleConfig,
  now: Date = new Date(),
): ReminderReadout[] {
  const today = startOfDay(now);
  return config.reminders
    .map((reminder) => {
      const parsed = parseISO(reminder.date);
      const valid = isValid(parsed);
      const daysUntil = valid
        ? differenceInCalendarDays(startOfDay(parsed), today)
        : 0;
      const tone: ReminderReadout["tone"] =
        daysUntil < 0 ? "overdue" : daysUntil <= 14 ? "soon" : "ok";
      return {
        reminder,
        daysUntil,
        text: valid ? format(parsed, "yyyy.MM.dd") : reminder.date || "날짜 없음",
        tone,
      };
    })
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

export function formatKrw(n: number): string {
  return `₩${Math.round(n).toLocaleString("ko-KR")}`;
}

export function ddayLabel(daysUntil: number): string {
  if (daysUntil === 0) return "D-Day";
  return daysUntil > 0 ? `D-${daysUntil}` : `D+${Math.abs(daysUntil)}`;
}
