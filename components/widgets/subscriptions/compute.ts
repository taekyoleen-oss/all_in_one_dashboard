/**
 * subscriptions · computation (date-fns).
 *
 *  Pure helpers: roll an anchor billing date forward to the next due date,
 *  normalize any cycle's amount to a monthly equivalent, and sum totals in a
 *  base currency (with a rough static FX table — this is a personal estimate,
 *  not an accounting tool; the live 환율 위젯 covers exact rates).
 */

import {
  parseISO,
  isValid,
  startOfDay,
  differenceInCalendarDays,
  addDays,
  addMonths,
  addYears,
  format,
} from "date-fns";
import type {
  Subscription,
  SubCurrency,
  SubscriptionsConfig,
} from "./types";

/** Rough static rates → KRW (estimate only; updated occasionally). */
const TO_KRW: Record<SubCurrency, number> = {
  KRW: 1,
  USD: 1380,
  EUR: 1490,
  JPY: 9.1,
};

/** Convert an amount between currencies via the static KRW table. */
export function convert(
  amount: number,
  from: SubCurrency,
  to: SubCurrency,
): number {
  if (from === to) return amount;
  const krw = amount * TO_KRW[from];
  return krw / TO_KRW[to];
}

export interface SubReadout {
  /** Next due date (effective, rolled forward), or null if the date is invalid. */
  nextDue: Date | null;
  /** Whole calendar days until the next due date (negative = overdue today-ish). */
  daysUntil: number;
  /** "yyyy.MM.dd" of the next due date. */
  nextText: string;
  /** This entry's cost expressed per month (for totals). */
  monthlyAmount: number;
}

/** Roll `anchorDate` forward by whole cycles until it's >= today. */
export function computeNextDue(
  sub: Subscription,
  now: Date = new Date(),
): SubReadout {
  const parsed = parseISO(sub.anchorDate);
  const today = startOfDay(now);

  const monthlyAmount = (() => {
    switch (sub.cycle) {
      case "weekly":
        return (sub.amount * 52) / 12;
      case "yearly":
        return sub.amount / 12;
      default:
        return sub.amount;
    }
  })();

  if (!isValid(parsed)) {
    return {
      nextDue: null,
      daysUntil: 0,
      nextText: sub.anchorDate || "날짜 없음",
      monthlyAmount,
    };
  }

  let due = startOfDay(parsed);
  const step = (d: Date) =>
    sub.cycle === "weekly"
      ? addDays(d, 7)
      : sub.cycle === "yearly"
        ? addYears(d, 1)
        : addMonths(d, 1);

  // Roll forward (or back) so `due` is the soonest occurrence on/after today.
  let guard = 0;
  while (due < today && guard < 6000) {
    due = step(due);
    guard++;
  }
  // If anchor is in the future, walk back to the latest occurrence still >= today
  // is unnecessary — a future anchor IS the next due. Keep as-is.

  const daysUntil = differenceInCalendarDays(due, today);
  return {
    nextDue: due,
    daysUntil,
    nextText: format(due, "yyyy.MM.dd"),
    monthlyAmount,
  };
}

export interface SubsTotals {
  monthly: number;
  yearly: number;
  base: SubCurrency;
  activeCount: number;
}

/** Sum active entries' monthly equivalents into the base currency. */
export function computeTotals(config: SubscriptionsConfig): SubsTotals {
  let monthly = 0;
  let activeCount = 0;
  for (const sub of config.entries) {
    if (!sub.active) continue;
    activeCount++;
    const { monthlyAmount } = computeNextDue(sub);
    monthly += convert(monthlyAmount, sub.currency, config.baseCurrency);
  }
  return {
    monthly,
    yearly: monthly * 12,
    base: config.baseCurrency,
    activeCount,
  };
}

/** Active entries sorted by soonest next-due date. */
export function sortedByNextDue(
  config: SubscriptionsConfig,
  now: Date = new Date(),
): Array<{ sub: Subscription; readout: SubReadout }> {
  return config.entries
    .filter((s) => s.active)
    .map((sub) => ({ sub, readout: computeNextDue(sub, now) }))
    .sort((a, b) => a.readout.daysUntil - b.readout.daysUntil);
}

/** Format a money amount with the currency symbol (no decimals for KRW/JPY). */
export function formatMoney(amount: number, currency: SubCurrency): string {
  const symbol = { KRW: "₩", USD: "$", EUR: "€", JPY: "¥" }[currency];
  const noDecimals = currency === "KRW" || currency === "JPY";
  const rounded = noDecimals ? Math.round(amount) : Math.round(amount * 100) / 100;
  return `${symbol}${rounded.toLocaleString("ko-KR", {
    maximumFractionDigits: noDecimals ? 0 : 2,
  })}`;
}
