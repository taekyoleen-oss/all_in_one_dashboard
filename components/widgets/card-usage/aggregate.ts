/**
 * card-usage — client-side aggregation + formatting (설계서 §2.1 #9, §5.4).
 *
 *  Pure helpers that turn the raw `pb_card_transactions` rows (imported as the
 *  shared `CardTxn` shape from output/api-shapes.ts — never re-declared) into the
 *  `CardSummary` the views render. The widget reads rows via the browser client
 *  (RLS-scoped) and calls `summarize()` — no server route is involved.
 *
 *  Rules:
 *    • Month total/categories EXCLUDE the sentinel rows (category '미인식' and
 *      '취소'): an unrecognized row has amount 0 and isn't a real spend, and a
 *      cancellation is not a charge. Unrecognized rows are counted separately so
 *      the user sees the no-loss queue size.
 *    • `byCategory` / `byCard` are sorted descending by total.
 *    • `monthly` covers the most recent `trendMonths` months (oldest→newest),
 *      including months with zero spend so the chart has a continuous axis.
 */

import {
  CARD_UNRECOGNIZED_CATEGORY,
  type CardTxn,
  type CardSummary,
  type CardCategorySummary,
  type CardPerCardSummary,
  type CardMonthlyPoint,
} from "@/output/api-shapes";

/** Categories that are not real spend and must be excluded from totals. */
const EXCLUDED_CATEGORIES = new Set<string>([CARD_UNRECOGNIZED_CATEGORY, "취소"]);

/** ISO yyyy-mm month key from an ISO yyyy-mm-dd date string. */
export function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

/** The current month key (yyyy-mm) in local time. */
export function currentMonthKey(now: Date = new Date()): string {
  return `${now.getFullYear().toString().padStart(4, "0")}-${(now.getMonth() + 1)
    .toString()
    .padStart(2, "0")}`;
}

/** Is this a real, countable spend row (not a sentinel)? */
function isSpend(txn: CardTxn): boolean {
  const cat = txn.category ?? "";
  return !EXCLUDED_CATEGORIES.has(cat) && txn.amount > 0;
}

/** Build the list of the last `count` month keys ending at `month` (oldest→newest). */
function recentMonths(month: string, count: number): string[] {
  const [y, m] = month.split("-").map(Number);
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    out.push(
      `${d.getFullYear().toString().padStart(4, "0")}-${(d.getMonth() + 1)
        .toString()
        .padStart(2, "0")}`,
    );
  }
  return out;
}

/**
 * Aggregate `txns` into a `CardSummary` for `month`, with a `trendMonths`-long
 * monthly trend. `txns` should already be filtered to the selected cards (or all).
 */
export function summarize(
  txns: CardTxn[],
  month: string,
  trendMonths: number,
): CardSummary {
  // ---- this-month rollups ----
  const inMonth = txns.filter((t) => monthKey(t.txn_date) === month);

  let monthTotal = 0;
  let monthCount = 0;
  let unrecognizedCount = 0;
  const catMap = new Map<string, { total: number; count: number }>();
  const cardMap = new Map<string, { total: number; count: number }>();

  for (const t of inMonth) {
    if ((t.category ?? "") === CARD_UNRECOGNIZED_CATEGORY) unrecognizedCount++;
    if (!isSpend(t)) continue;
    monthTotal += t.amount;
    monthCount += 1;

    const cat = t.category ?? "기타";
    const c = catMap.get(cat) ?? { total: 0, count: 0 };
    c.total += t.amount;
    c.count += 1;
    catMap.set(cat, c);

    const cd = cardMap.get(t.card_id) ?? { total: 0, count: 0 };
    cd.total += t.amount;
    cd.count += 1;
    cardMap.set(t.card_id, cd);
  }

  const byCategory: CardCategorySummary[] = [...catMap.entries()]
    .map(([category, v]) => ({ category, total: v.total, count: v.count }))
    .sort((a, b) => b.total - a.total);

  const byCard: CardPerCardSummary[] = [...cardMap.entries()]
    .map(([card_id, v]) => ({ card_id, total: v.total, count: v.count }))
    .sort((a, b) => b.total - a.total);

  // ---- monthly trend (continuous axis incl. zero months) ----
  const months = recentMonths(month, Math.max(1, trendMonths));
  const monthTotals = new Map<string, { total: number; count: number }>();
  for (const mk of months) monthTotals.set(mk, { total: 0, count: 0 });
  for (const t of txns) {
    if (!isSpend(t)) continue;
    const mk = monthKey(t.txn_date);
    const bucket = monthTotals.get(mk);
    if (bucket) {
      bucket.total += t.amount;
      bucket.count += 1;
    }
  }
  const monthly: CardMonthlyPoint[] = months.map((mk) => ({
    month: mk,
    total: monthTotals.get(mk)!.total,
    count: monthTotals.get(mk)!.count,
  }));

  return {
    month,
    monthTotal,
    monthCount,
    byCategory,
    byCard,
    monthly,
    unrecognizedCount,
  };
}

/** Format a KRW amount, e.g. 12500 → "₩12,500". */
export function formatKrw(value: number): string {
  return `₩${Math.round(value).toLocaleString("ko-KR")}`;
}

/** Compact KRW for tight tiles, e.g. 1250000 → "125만", 12500 → "1.3만". */
export function formatKrwCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 100_000_000) return `${(value / 100_000_000).toFixed(1)}억`;
  if (abs >= 10_000) {
    const man = value / 10_000;
    return `${man >= 100 ? Math.round(man) : man.toFixed(1)}만`;
  }
  return value.toLocaleString("ko-KR");
}

/** A short "yyyy-mm" → "M월" label for the trend axis. */
export function monthLabel(monthKeyStr: string): string {
  const m = Number(monthKeyStr.split("-")[1]);
  return `${m}월`;
}
