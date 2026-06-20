"use client";

/**
 * card-usage · Charts — simple category bars + monthly trend (설계서 §2.1 #9).
 *
 *  Pure SVG/flex bars (no chart library). Accessibility: every bar carries BOTH
 *  a color AND a text label + value, so color is never the only signal. Bars use
 *  a width/height transition that is disabled under `prefers-reduced-motion`
 *  (the `motion-reduce:` Tailwind variant). All amounts are KRW.
 */

import * as React from "react";
import type { CardCategorySummary, CardMonthlyPoint } from "@/output/api-shapes";
import { categoryColor } from "./types";
import { formatKrw, formatKrwCompact, monthLabel } from "./aggregate";

/** Horizontal category breakdown: color swatch + label + bar + amount. */
export function CategoryBars({
  data,
  total,
}: {
  data: CardCategorySummary[];
  total: number;
}) {
  if (data.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">카테고리 데이터가 없습니다.</p>
    );
  }
  const max = Math.max(...data.map((d) => d.total), 1);

  return (
    <ul className="flex flex-col gap-1.5" aria-label="카테고리별 사용액">
      {data.map((d, i) => {
        const pct = total > 0 ? Math.round((d.total / total) * 100) : 0;
        const widthPct = Math.max(2, Math.round((d.total / max) * 100));
        const color = categoryColor(i);
        return (
          <li key={d.category} className="flex flex-col gap-0.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="flex min-w-0 items-center gap-1.5">
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: color }}
                />
                <span className="truncate text-foreground">{d.category}</span>
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {formatKrw(d.total)} · {pct}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none"
                style={{ width: `${widthPct}%`, backgroundColor: color }}
                role="img"
                aria-label={`${d.category} ${formatKrw(d.total)}, 전체의 ${pct}퍼센트`}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Vertical monthly trend: a column per month with a value label under each. */
export function MonthlyTrend({ data }: { data: CardMonthlyPoint[] }) {
  if (data.length === 0) {
    return <p className="text-xs text-muted-foreground">추이 데이터가 없습니다.</p>;
  }
  const max = Math.max(...data.map((d) => d.total), 1);

  return (
    <div
      className="flex items-end justify-between gap-1.5"
      aria-label="월별 사용액 추이"
    >
      {data.map((d, i) => {
        const heightPct = Math.max(2, Math.round((d.total / max) * 100));
        // The latest month is emphasized; earlier ones are muted.
        const isLatest = i === data.length - 1;
        return (
          <div
            key={d.month}
            className="flex min-w-0 flex-1 flex-col items-center gap-1"
          >
            <span className="text-[10px] tabular-nums text-muted-foreground">
              {d.total > 0 ? formatKrwCompact(d.total) : "—"}
            </span>
            <div className="flex h-20 w-full items-end justify-center">
              <div
                className={[
                  "w-full max-w-7 rounded-t-[3px] transition-[height] duration-500 motion-reduce:transition-none",
                  isLatest ? "bg-primary" : "bg-primary/45",
                ].join(" ")}
                style={{ height: `${heightPct}%` }}
                role="img"
                aria-label={`${monthLabel(d.month)} ${formatKrw(d.total)}`}
              />
            </div>
            <span
              className={[
                "text-[10px]",
                isLatest ? "font-medium text-foreground" : "text-muted-foreground",
              ].join(" ")}
            >
              {monthLabel(d.month)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
