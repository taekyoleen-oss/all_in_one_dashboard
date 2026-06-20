"use client";

/**
 * stock · ExpandedView — full multi-symbol list with mini-sparklines (설계서 §2.1).
 *
 *  Same live subscription as compact, rendered larger with a rolling sparkline
 *  per row and a connection/source status line. Managing symbols flows through
 *  the ConfigEditor (편집) per the frozen contract (no onChange here).
 */

import * as React from "react";
import type { ExpandedViewProps } from "@/lib/widgets/contract";
import { resolveMeta } from "@/lib/api/stock/symbols";
import { useStockQuotes } from "./useStockQuotes";
import { QuoteRow } from "./QuoteRow";
import type { StockConfig } from "./types";

const CONN_LABEL: Record<string, string> = {
  connecting: "연결 중…",
  live: "실시간",
  polling: "폴링(근사치)",
  idle: "대기",
};

export function StockExpandedView({ config }: ExpandedViewProps<StockConfig>) {
  const { quotes, history, provider, stale, conn, errors } = useStockQuotes(
    config.symbols,
  );

  if (config.symbols.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        종목이 없습니다. 위젯 메뉴의 “편집”에서 지수·종목을 추가하세요.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          출처:{" "}
          {provider === "kis"
            ? "한국투자증권(KIS)"
            : provider === "fallback"
              ? "공개 시세(근사치)"
              : "—"}
        </span>
        <span
          className={[
            "rounded-full px-2 py-0.5",
            conn === "live"
              ? "bg-positive/10 text-positive"
              : "bg-muted text-muted-foreground",
          ].join(" ")}
        >
          {CONN_LABEL[conn] ?? conn}
        </span>
      </div>

      <ul className="flex flex-col gap-1 rounded-[var(--radius)] border border-border bg-card/40 p-2">
        {config.symbols.map((sym) => {
          const meta = resolveMeta(sym);
          return (
            <QuoteRow
              key={sym}
              symbol={sym}
              name={meta.name}
              quote={quotes.get(sym)}
              history={history.get(sym)}
              size="expanded"
              showSparkline
            />
          );
        })}
      </ul>

      {errors.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          시세를 불러오지 못한 종목: {errors.join(", ")}
        </p>
      ) : null}
      {stale ? (
        <p className="text-xs text-muted-foreground">
          공개 시세 기반 근사치입니다. 실시간 체결가는 KIS 연결 시 제공됩니다.
        </p>
      ) : null}

      <p className="text-xs text-muted-foreground">
        지수 토글·국내 종목 추가/삭제는 위젯 메뉴의 “편집”에서 할 수 있습니다.
      </p>
    </div>
  );
}

export default StockExpandedView;
