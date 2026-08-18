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
  /**
   * 구독중(true) / 해지(false). 기본값은 구독중.
   * 해지해도 기록은 남기고 합계·다가오는 결제에서만 빠진다.
   */
  active: boolean;
  /**
   * 해지일 (ISO yyyy-MM-dd, 선택) — `active === false`일 때만 의미가 있다.
   * 언제 끊었는지 기록용이며, 비워 둘 수도 있다(날짜 없이 해지만 표시).
   */
  canceledAt?: string;
}

/** 상태 라벨 — 목록·요약에서 같은 문구를 쓰도록 한 곳에 둔다. */
export const SUB_STATUS_LABEL = { active: "구독중", canceled: "해지" } as const;

/** 표시용 상태 문자열. 해지이면서 날짜가 있으면 "해지 (2026.03.01)". */
export function subStatusText(sub: Pick<Subscription, "active" | "canceledAt">): string {
  if (sub.active) return SUB_STATUS_LABEL.active;
  const d = sub.canceledAt?.trim();
  // yyyy-MM-dd → yyyy.MM.dd (다른 날짜 표기와 통일). 형식이 다르면 원문 그대로.
  const pretty = d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d.replace(/-/g, ".") : d;
  return pretty ? `${SUB_STATUS_LABEL.canceled} (${pretty})` : SUB_STATUS_LABEL.canceled;
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
