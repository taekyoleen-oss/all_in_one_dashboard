/**
 * subscriptions widget — config shape (구독 관리: 정기결제·다음 결제일·월/연 합계).
 *
 *  All data lives in config (jsonb, like dday/todo) — no external API, no new DB
 *  table. Each entry is a recurring payment with a billing cycle and an anchor
 *  date (a known past/next billing date); the next due date is computed forward
 *  from the anchor. dataMode: 'static'.
 */

/** Billing cadence. */
export type BillingCycle = "weekly" | "monthly" | "yearly";

/** Supported display currencies (amounts are stored as entered). */
export type SubCurrency = "KRW" | "USD" | "EUR" | "JPY";

export interface Subscription {
  /** Stable id (list keys). */
  id: string;
  /** Service name, e.g. "Netflix". */
  name: string;
  /** Amount per billing cycle (in `currency`). */
  amount: number;
  /** Currency of `amount`. */
  currency: SubCurrency;
  /** Billing cadence. */
  cycle: BillingCycle;
  /**
   * Anchor billing date (ISO yyyy-MM-dd) — any real billing date. The next due
   * date rolls forward from here by whole cycles.
   */
  anchorDate: string;
  /** Optional category/label, e.g. "엔터테인먼트". */
  category?: string;
  /** Pastel tint key for the entry chip (color-mix base hue). */
  color?: string;
  /** When false, kept for records but excluded from totals/upcoming. */
  active: boolean;
}

export interface SubscriptionsConfig {
  entries: Subscription[];
  /** Currency the monthly/yearly totals are summed in (others are converted
   *  with a rough static rate — see compute.ts). */
  baseCurrency: SubCurrency;
}

export const CURRENCY_SYMBOL: Record<SubCurrency, string> = {
  KRW: "₩",
  USD: "$",
  EUR: "€",
  JPY: "¥",
};

export const CYCLE_LABEL: Record<BillingCycle, string> = {
  weekly: "주간",
  monthly: "월간",
  yearly: "연간",
};

export const DEFAULT_SUBSCRIPTIONS_CONFIG: SubscriptionsConfig = {
  baseCurrency: "KRW",
  entries: [],
};
