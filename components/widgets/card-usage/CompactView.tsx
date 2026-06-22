"use client";

/**
 * card-usage · CompactView — this month's spend + per-card summary (설계서 §2.1 #9).
 *
 *  Reads the user's cards + transactions via useCardData (browser client,
 *  RLS-scoped) and aggregates with summarize() for the current month. Shows the
 *  month total prominently + a short per-card breakdown. Reflows by @container
 *  width; the card filter comes from this instance's config (격리). sensitive:true
 *  at the definition level — values are personal spend; nothing is logged.
 */

import * as React from "react";
import type { CompactViewProps } from "@/lib/widgets/contract";
import { useCardData } from "./useCardData";
import { summarize, currentMonthKey, formatKrw, formatKrwCompact } from "./aggregate";
import { cardLabel } from "./cardLabel";
import type { CardUsageConfig } from "./types";

export function CardUsageCompactView({ config }: CompactViewProps<CardUsageConfig>) {
  const { cards, txns, status } = useCardData();

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
        카드가 없습니다. 편집에서 카드를 등록하세요.
      </p>
    );
  }

  const monthNum = Number(month.split("-")[1]);

  return (
    <div className="flex h-full flex-col gap-2 @container">
      <div className="shrink-0">
        <p className="text-xs text-muted-foreground">{monthNum}월 사용액</p>
        <p className="text-2xl font-semibold tabular-nums text-foreground @[180px]:text-3xl">
          {formatKrw(summary.monthTotal)}
        </p>
        <p className="text-[11px] text-muted-foreground">
          거래 {summary.monthCount}건
          {summary.unrecognizedCount > 0
            ? ` · 미인식 ${summary.unrecognizedCount}건`
            : ""}
        </p>
      </div>

      {summary.byCard.length > 0 ? (
        <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pb-scroll">
          {summary.byCard.map((c) => {
            const card = cards.find((cd) => cd.id === c.card_id);
            return (
              <li
                key={c.card_id}
                className="flex items-center justify-between gap-2 border-b border-border/50 pb-1 text-sm last:border-0 last:pb-0"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: card?.color ?? "var(--muted-foreground)" }}
                  />
                  <span className="truncate text-foreground">
                    {cardLabel(card)}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {formatKrwCompact(c.total)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="flex-1 text-xs text-muted-foreground">
          이번 달 사용 내역이 없습니다.
        </p>
      )}
    </div>
  );
}

export default CardUsageCompactView;
