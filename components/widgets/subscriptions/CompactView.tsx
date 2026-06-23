"use client";

/**
 * subscriptions · CompactView — monthly total + upcoming payments (구독 관리).
 *
 *  Header shows the monthly total (base currency). The list shows active
 *  subscriptions sorted by next due date, with a D-day-style "N일 후" badge.
 *  타일 하단 QuickAdd로 이름+금액을 바로 추가한다.
 */

import * as React from "react";
import { format } from "date-fns";
import type { CompactViewProps } from "@/lib/widgets/contract";
import { useNow } from "@/lib/utils/useNow";
import { useSaveWidgetConfig } from "@/lib/widgets/persistence";
import {
  QuickAdd,
  newItemId,
  quickInputClass,
  quickBtnClass,
} from "@/components/widgets/shared/QuickAdd";
import {
  sortedByNextDue,
  computeTotals,
  formatMoney,
} from "./compute";
import { CURRENCY_SYMBOL } from "./types";
import type { SubscriptionsConfig } from "./types";

function dueBadge(daysUntil: number): { text: string; cls: string } {
  if (daysUntil <= 0) return { text: "오늘", cls: "text-positive" };
  if (daysUntil <= 3) return { text: `${daysUntil}일 후`, cls: "text-positive" };
  if (daysUntil <= 7) return { text: `${daysUntil}일 후`, cls: "text-amber-600 dark:text-amber-400" };
  return { text: `${daysUntil}일 후`, cls: "text-muted-foreground" };
}

export function SubscriptionsCompactView({
  config,
  instanceId,
}: CompactViewProps<SubscriptionsConfig>) {
  const now = useNow(3_600_000);
  const totals = computeTotals(config);
  const items = sortedByNextDue(config, now);

  return (
    <div className="flex h-full w-full flex-col gap-2">
      <div className="flex shrink-0 items-baseline justify-between gap-2">
        <span className="text-xs text-muted-foreground">월 합계</span>
        <span className="font-mono text-lg font-semibold tabular-nums text-foreground @[220px]/widget:text-xl">
          {formatMoney(totals.monthly, totals.base)}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="my-auto text-center text-sm text-muted-foreground">
          구독이 없습니다.
        </p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-scroll">
          <ul className="my-auto flex flex-col gap-1.5">
            {items.map(({ sub, readout }) => {
              const badge = dueBadge(readout.daysUntil);
              return (
                <li
                  key={sub.id}
                  className="flex items-center justify-between gap-2"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium text-foreground">
                      {sub.name || "(이름 없음)"}
                    </span>
                    <span className={`text-[11px] ${badge.cls}`}>
                      {badge.text} · {readout.nextText}
                    </span>
                  </div>
                  <span className="shrink-0 font-mono text-sm tabular-nums text-foreground">
                    {CURRENCY_SYMBOL[sub.currency]}
                    {Math.round(sub.amount).toLocaleString("ko-KR")}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <SubQuickAdd config={config} instanceId={instanceId} />
    </div>
  );
}

function SubQuickAdd({
  config,
  instanceId,
}: {
  config: SubscriptionsConfig;
  instanceId: string;
}) {
  const save = useSaveWidgetConfig();
  const [name, setName] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const add = () => {
    const n = name.trim();
    const a = Number(amount);
    if (!n || !Number.isFinite(a) || a <= 0) return;
    save(instanceId, {
      ...config,
      entries: [
        ...config.entries,
        {
          id: newItemId("sub"),
          name: n,
          amount: a,
          currency: config.baseCurrency,
          cycle: "monthly" as const,
          anchorDate: format(new Date(), "yyyy-MM-dd"),
          category: "",
          active: true,
        },
      ],
    });
    setName("");
    setAmount("");
  };
  return (
    <QuickAdd label="구독 추가">
      {() => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
          className="flex items-center gap-1.5"
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름"
            className={`${quickInputClass} min-w-0 flex-1`}
          />
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="월 금액"
            className={`${quickInputClass} w-20`}
          />
          <button type="submit" disabled={!name.trim() || !amount} className={quickBtnClass}>
            추가
          </button>
        </form>
      )}
    </QuickAdd>
  );
}

export default SubscriptionsCompactView;
