"use client";

/**
 * subscriptions · ExpandedView — totals + full payment schedule (구독 관리).
 *
 *  Monthly + yearly totals headline, then every active subscription as a card
 *  sorted by next due date (amount, cycle, category, days-until). Managing
 *  entries flows through ConfigEditor (편집) per the frozen contract.
 */

import * as React from "react";
import type { ExpandedViewProps } from "@/lib/widgets/contract";
import { useNow } from "@/lib/utils/useNow";
import {
  sortedForList,
  computeTotals,
  formatMoney,
} from "./compute";
import { CYCLE_LABEL, CURRENCY_SYMBOL, subStatusText } from "./types";
import type { SubscriptionsConfig } from "./types";

export function SubscriptionsExpandedView({
  config,
}: ExpandedViewProps<SubscriptionsConfig>) {
  const now = useNow(3_600_000);
  const totals = computeTotals(config);
  const items = sortedForList(config, now);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-0.5 rounded-[var(--radius)] border border-border bg-card/60 p-4">
          <span className="text-xs text-muted-foreground">월 합계</span>
          <span className="font-mono text-2xl font-semibold tabular-nums text-foreground">
            {formatMoney(totals.monthly, totals.base)}
          </span>
          <span className="text-[11px] text-muted-foreground">
            구독 {totals.activeCount}개
          </span>
        </div>
        <div className="flex flex-col gap-0.5 rounded-[var(--radius)] border border-border bg-card/60 p-4">
          <span className="text-xs text-muted-foreground">연 합계 (추정)</span>
          <span className="font-mono text-2xl font-semibold tabular-nums text-foreground">
            {formatMoney(totals.yearly, totals.base)}
          </span>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          등록된 구독이 없습니다. 위젯 메뉴의 “편집”에서 추가하세요.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {items.map(({ sub, readout }) => (
            <li
              key={sub.id}
              className="flex items-center justify-between gap-3 rounded-[var(--radius)] border border-border bg-card/60 p-3"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="flex items-center gap-1.5">
                  <span
                    className={[
                      "truncate text-base font-medium",
                      sub.active
                        ? "text-foreground"
                        : "text-muted-foreground line-through",
                    ].join(" ")}
                  >
                    {sub.name || "(이름 없음)"}
                  </span>
                  {/* 상태 배지 — 색만이 아니라 글자로도 구분(접근성). */}
                  <span
                    className={[
                      "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
                      sub.active
                        ? "bg-primary/15 text-foreground"
                        : "bg-muted text-muted-foreground",
                    ].join(" ")}
                  >
                    {subStatusText(sub)}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {CYCLE_LABEL[sub.cycle]}
                  {sub.active
                    ? ` · 다음 ${readout.nextText}${readout.daysUntil >= 0 ? ` (${readout.daysUntil}일 후)` : ""}`
                    : ""}
                  {sub.category ? ` · ${sub.category}` : ""}
                </span>
              </div>
              <span
                className={[
                  "shrink-0 font-mono text-lg font-semibold tabular-nums",
                  sub.active ? "text-foreground" : "text-muted-foreground",
                ].join(" ")}
              >
                {CURRENCY_SYMBOL[sub.currency]}
                {Math.round(sub.amount).toLocaleString("ko-KR")}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">
        항목 추가·수정·삭제는 위젯 메뉴의 “편집”에서 할 수 있습니다. 통화 합계는 추정 환율 기준입니다.
      </p>
    </div>
  );
}

export default SubscriptionsExpandedView;
