"use client";

/**
 * subscriptions · SubscriptionManager — add / edit / remove recurring payments.
 *
 *  Controlled: reports the whole next config via onChange (parent persists). Each
 *  entry edits in place (name, amount, currency, cycle, anchor date, category,
 *  active). New entries default to today's anchor + monthly KRW.
 */

import * as React from "react";
import { format } from "date-fns";
import { Trash2, Plus } from "lucide-react";
import { newItemId } from "@/components/widgets/shared/QuickAdd";
import type {
  Subscription,
  SubscriptionsConfig,
  SubCurrency,
  BillingCycle,
} from "./types";
import { CYCLE_LABEL } from "./types";

const CURRENCIES: SubCurrency[] = ["KRW", "USD", "EUR", "JPY"];
const CYCLES: BillingCycle[] = ["weekly", "monthly", "yearly"];

const inputCls =
  "min-w-0 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function SubscriptionManager({
  config,
  onChange,
}: {
  config: SubscriptionsConfig;
  onChange: (next: SubscriptionsConfig) => void;
}) {
  const setEntries = (entries: Subscription[]) => onChange({ ...config, entries });

  const patch = (id: string, fields: Partial<Subscription>) =>
    setEntries(
      config.entries.map((e) => (e.id === id ? { ...e, ...fields } : e)),
    );

  const remove = (id: string) =>
    setEntries(config.entries.filter((e) => e.id !== id));

  const add = () =>
    setEntries([
      ...config.entries,
      {
        id: newItemId("sub"),
        name: "",
        amount: 0,
        currency: config.baseCurrency,
        cycle: "monthly",
        anchorDate: format(new Date(), "yyyy-MM-dd"),
        category: "",
        active: true,
      },
    ]);

  return (
    <div className="flex flex-col gap-3">
      {/* Base currency for the totals */}
      <label className="flex items-center justify-between gap-2 rounded-md border border-border bg-background/40 px-3 py-2 text-sm">
        <span className="text-muted-foreground">합계 기준 통화</span>
        <select
          value={config.baseCurrency}
          onChange={(e) =>
            onChange({ ...config, baseCurrency: e.target.value as SubCurrency })
          }
          className={inputCls}
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <ul className="flex flex-col gap-2">
        {config.entries.map((e) => (
          <li
            key={e.id}
            className="flex flex-col gap-2 rounded-md border border-border bg-background/40 p-2"
          >
            <div className="flex items-center gap-2">
              <input
                value={e.name}
                onChange={(ev) => patch(e.id, { name: ev.target.value })}
                placeholder="서비스 이름 (예: Netflix)"
                className={`${inputCls} flex-1`}
              />
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={e.active}
                  onChange={(ev) => patch(e.id, { active: ev.target.checked })}
                  className="size-4 accent-[var(--primary)]"
                />
                사용중
              </label>
              <button
                type="button"
                aria-label={`${e.name || "구독"} 삭제`}
                onClick={() => remove(e.id)}
                className="inline-flex size-7 items-center justify-center rounded-md text-destructive outline-none transition-colors hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Trash2 size={15} />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={e.amount === 0 ? "" : e.amount}
                onChange={(ev) =>
                  patch(e.id, { amount: Number(ev.target.value) || 0 })
                }
                placeholder="금액"
                className={`${inputCls} w-24`}
              />
              <select
                value={e.currency}
                onChange={(ev) =>
                  patch(e.id, { currency: ev.target.value as SubCurrency })
                }
                className={inputCls}
                aria-label="통화"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={e.cycle}
                onChange={(ev) =>
                  patch(e.id, { cycle: ev.target.value as BillingCycle })
                }
                className={inputCls}
                aria-label="주기"
              >
                {CYCLES.map((c) => (
                  <option key={c} value={c}>
                    {CYCLE_LABEL[c]}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={e.anchorDate}
                onChange={(ev) => patch(e.id, { anchorDate: ev.target.value })}
                aria-label="결제일(기준)"
                className={inputCls}
              />
              <input
                value={e.category ?? ""}
                onChange={(ev) => patch(e.id, { category: ev.target.value })}
                placeholder="분류 (선택)"
                className={`${inputCls} w-28`}
              />
            </div>
          </li>
        ))}
        {config.entries.length === 0 ? (
          <li className="rounded-md border border-dashed border-border px-2 py-3 text-center text-xs text-muted-foreground">
            등록된 구독이 없습니다.
          </li>
        ) : null}
      </ul>

      <button
        type="button"
        onClick={add}
        className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Plus size={15} aria-hidden />
        구독 추가
      </button>
      <p className="text-[11px] text-muted-foreground">
        ‘결제일(기준)’은 실제 결제된 날짜 아무거나 넣으면 다음 결제일을 자동 계산합니다.
        통화 합계는 대략적인 추정 환율로 환산됩니다.
      </p>
    </div>
  );
}

export default SubscriptionManager;
