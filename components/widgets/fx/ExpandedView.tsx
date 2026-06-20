"use client";

/**
 * fx · ExpandedView — full pair list + source/refresh line (설계서 §2.2).
 *
 *  Same poll subscription as compact, rendered larger with the rate date, a
 *  last-updated time, and a manual refresh. Managing currencies flows through
 *  the ConfigEditor (편집) per the frozen contract (no onChange here).
 */

import * as React from "react";
import type { ExpandedViewProps } from "@/lib/widgets/contract";
import { FxRateRow } from "./FxRateRow";
import { useFxRates } from "./useFxRates";
import type { FxConfig } from "./types";

function formatTime(ts: number | null): string {
  if (ts === null) return "—";
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function FxExpandedView({ config }: ExpandedViewProps<FxConfig>) {
  const { base, rows, date, stale, loading, error, lastUpdated, refresh } =
    useFxRates(config.base, config.quotes);

  if (config.quotes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        통화쌍이 없습니다. 위젯 메뉴의 “편집”에서 통화를 추가하세요.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>기준: {base}{date ? ` · ${date}` : ""}</span>
        <button
          type="button"
          onClick={refresh}
          className="rounded-full border border-border px-2 py-0.5 text-foreground outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring"
        >
          새로고침
        </button>
      </div>

      {error && rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">환율을 불러오지 못했습니다.</p>
      ) : loading && rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">환율 불러오는 중…</p>
      ) : (
        <ul className="flex flex-col gap-1 rounded-[var(--radius)] border border-border bg-card/40 p-2">
          {rows.map((row) => (
            <FxRateRow key={row.quote} base={base} row={row} size="expanded" />
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{stale ? "유럽중앙은행(ECB) 기준환율 · 일별 갱신" : "실시간"}</span>
        <span>갱신: {formatTime(lastUpdated)}</span>
      </div>
    </div>
  );
}

export default FxExpandedView;
