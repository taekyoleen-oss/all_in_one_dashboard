"use client";

/**
 * stock · CompactView — live index/stock prices on the canvas tile (설계서 §2.1).
 *
 *  Subscribes via useStockQuotes (SSE + poll fallback). Each row shows name +
 *  price + change with color AND ▲/▼ symbol (data-direction) and a reduced-motion
 *  -aware tick flash. A tiny badge marks approximate (fallback) data. Reflows by
 *  @container width; the symbol set comes from this instance's config (격리).
 */

import * as React from "react";
import type { CompactViewProps } from "@/lib/widgets/contract";
import { resolveMeta } from "@/lib/api/stock/symbols";
import { useStockQuotes } from "./useStockQuotes";
import { QuoteRow } from "./QuoteRow";
import { RefreshBar } from "./RefreshBar";
import type { StockConfig } from "./types";

export function StockCompactView({ config }: CompactViewProps<StockConfig>) {
  const { quotes, history, stale, conn, lastUpdated, refresh } = useStockQuotes(
    config.symbols,
  );

  if (config.symbols.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        종목이 없습니다. 편집에서 지수·종목을 추가하세요.
      </p>
    );
  }

  return (
    <div className="flex h-full flex-col gap-1">
      <RefreshBar lastUpdated={lastUpdated} onRefresh={refresh} size="compact" />
      <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pb-scroll">
        {config.symbols.map((sym) => {
          const meta = resolveMeta(sym);
          return (
            <QuoteRow
              key={sym}
              symbol={sym}
              name={meta.name}
              quote={quotes.get(sym)}
              history={history.get(sym)}
              size="compact"
              showSparkline={false}
            />
          );
        })}
      </ul>

      {stale ? (
        <p className="shrink-0 text-right text-[10px] text-muted-foreground">
          근사치{conn === "polling" ? " · 폴링" : ""}
        </p>
      ) : null}
    </div>
  );
}

export default StockCompactView;
