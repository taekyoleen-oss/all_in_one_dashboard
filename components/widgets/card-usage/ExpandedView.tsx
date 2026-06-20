"use client";

/**
 * card-usage · ExpandedView — trend + category chart + transaction list (설계서 §2.1 #9).
 *
 *  Same RLS-scoped read as compact (useCardData), rendered large: a monthly trend
 *  chart, a per-category breakdown (color + label + amount), and a recent
 *  transaction list. Charts convey via color AND labels and honor reduced motion
 *  (see Charts.tsx). Read-only — registering cards / importing CSV / manual entry
 *  all live in the ConfigEditor (편집) per the frozen contract (no onChange here).
 *  A 새로고침 re-reads the snapshot. sensitive:true — nothing is logged.
 */

import * as React from "react";
import { RefreshCw, AlertTriangle } from "lucide-react";
import type { ExpandedViewProps } from "@/lib/widgets/contract";
import { useCardData } from "./useCardData";
import {
  summarize,
  currentMonthKey,
  formatKrw,
  monthLabel,
} from "./aggregate";
import { CategoryBars, MonthlyTrend } from "./Charts";
import { cardLabel } from "./cardLabel";
import { CARD_UNRECOGNIZED_CATEGORY, type CardTxn, type Card } from "@/output/api-shapes";
import type { CardUsageConfig } from "./types";

/** Compact source badge text. */
function sourceLabel(source: CardTxn["source"]): string {
  switch (source) {
    case "sms":
      return "SMS";
    case "email":
      return "메일";
    case "csv":
      return "CSV";
    case "manual":
      return "수기";
  }
}

export function CardUsageExpandedView({ config }: ExpandedViewProps<CardUsageConfig>) {
  const { cards, txns, status, refresh } = useCardData();

  const cardById = React.useMemo(() => {
    const m = new Map<string, Card>();
    for (const c of cards) m.set(c.id, c);
    return m;
  }, [cards]);

  const filtered = React.useMemo(() => {
    if (config.cardIds.length === 0) return txns;
    const set = new Set(config.cardIds);
    return txns.filter((t) => set.has(t.card_id));
  }, [txns, config.cardIds]);

  const month = currentMonthKey();
  const summary = React.useMemo(
    () => summarize(filtered, month, config.trendMonths),
    [filtered, month, config.trendMonths],
  );

  // Most recent transactions for the list (already date-desc from the query).
  const recent = React.useMemo(() => filtered.slice(0, 40), [filtered]);

  if (status === "loading") {
    return <p className="text-sm text-muted-foreground">불러오는 중…</p>;
  }
  if (status === "signed-out") {
    return <p className="text-sm text-muted-foreground">로그인이 필요합니다.</p>;
  }
  if (status === "error") {
    return <p className="text-sm text-muted-foreground">불러오지 못했습니다.</p>;
  }
  if (cards.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        카드가 없습니다. 위젯 메뉴의 “편집”에서 카드를 등록하세요.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* header: month total + refresh */}
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">{monthLabel(month)} 사용액</p>
          <p className="text-3xl font-semibold tabular-nums text-foreground">
            {formatKrw(summary.monthTotal)}
          </p>
          <p className="text-xs text-muted-foreground">거래 {summary.monthCount}건</p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-foreground outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <RefreshCw size={13} aria-hidden />
          새로고침
        </button>
      </div>

      {/* no-loss queue notice */}
      {summary.unrecognizedCount > 0 ? (
        <div
          role="note"
          className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-foreground"
        >
          <AlertTriangle size={15} aria-hidden className="mt-0.5 shrink-0 text-amber-600" />
          <p>
            인식하지 못한 거래 {summary.unrecognizedCount}건이
            <strong> {CARD_UNRECOGNIZED_CATEGORY}</strong>으로 보관되어 있습니다.
            아래 목록에서 확인하고 편집에서 금액·가맹점을 수정하세요.
          </p>
        </div>
      ) : null}

      {/* monthly trend */}
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-foreground">월별 추이</h3>
        <MonthlyTrend data={summary.monthly} />
      </section>

      {/* category breakdown */}
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-foreground">카테고리</h3>
        <CategoryBars data={summary.byCategory} total={summary.monthTotal} />
      </section>

      {/* recent transactions */}
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-foreground">최근 거래</h3>
        {recent.length === 0 ? (
          <p className="text-xs text-muted-foreground">거래 내역이 없습니다.</p>
        ) : (
          <ul className="flex flex-col gap-1 rounded-[var(--radius)] border border-border bg-card/40 p-2">
            {recent.map((t) => {
              const isUnrec = (t.category ?? "") === CARD_UNRECOGNIZED_CATEGORY;
              return (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-2 border-b border-border/40 py-1 text-sm last:border-0"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-foreground">
                      {t.merchant || "(가맹점 미상)"}
                    </span>
                    <span className="truncate text-[11px] text-muted-foreground">
                      {t.txn_date} · {cardLabel(cardById.get(t.card_id))} ·{" "}
                      {sourceLabel(t.source)}
                      {t.category && !isUnrec ? ` · ${t.category}` : ""}
                    </span>
                  </span>
                  <span
                    className={[
                      "shrink-0 tabular-nums",
                      isUnrec ? "text-amber-600" : "text-foreground",
                    ].join(" ")}
                  >
                    {isUnrec ? CARD_UNRECOGNIZED_CATEGORY : formatKrw(t.amount)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

export default CardUsageExpandedView;
