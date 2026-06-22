"use client";

/**
 * stock · CompactView — live index/stock prices on the canvas tile (설계서 §2.1).
 *
 *  Subscribes via useStockQuotes (SSE + poll fallback). Each row shows name +
 *  price + change (color AND ▲/▼). 타일 하단 QuickAdd로 종목명·코드를 검색해 바로
 *  추가한다(국내 종목 카탈로그, 외부호출 없음).
 */

import * as React from "react";
import type { CompactViewProps } from "@/lib/widgets/contract";
import { resolveMeta, searchKrStocks } from "@/lib/api/stock/symbols";
import { useSaveWidgetConfig } from "@/lib/widgets/persistence";
import { QuickAdd, quickInputClass } from "@/components/widgets/shared/QuickAdd";
import { useStockQuotes } from "./useStockQuotes";
import { QuoteRow } from "./QuoteRow";
import { RefreshBar } from "./RefreshBar";
import type { StockConfig } from "./types";

export function StockCompactView({
  config,
  instanceId,
}: CompactViewProps<StockConfig>) {
  const { quotes, history, stale, conn, lastUpdated, refresh } = useStockQuotes(
    config.symbols,
  );

  return (
    <div className="flex h-full flex-col gap-1">
      {config.symbols.length === 0 ? (
        <p className="text-sm text-muted-foreground">종목이 없습니다.</p>
      ) : (
        <>
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
        </>
      )}

      <StockQuickAdd config={config} instanceId={instanceId} />
    </div>
  );
}

/** 타일 하단 빠른 추가: 국내 종목 검색 → 결과 클릭으로 추가(중복 제외). */
function StockQuickAdd({
  config,
  instanceId,
}: {
  config: StockConfig;
  instanceId: string;
}) {
  const save = useSaveWidgetConfig();
  const [query, setQuery] = React.useState("");
  const results = React.useMemo(() => searchKrStocks(query).slice(0, 6), [query]);
  const present = new Set(config.symbols);

  const addSymbol = (sym: string) => {
    if (present.has(sym)) {
      setQuery("");
      return;
    }
    save(instanceId, { ...config, symbols: [...config.symbols, sym] });
    setQuery("");
  };

  return (
    <QuickAdd label="종목 추가">
      {() => (
        <div className="flex flex-col gap-1.5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (results[0]) addSymbol(results[0].symbol);
            }}
          >
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="종목명·코드 검색 (예: 삼성전자)"
              className={`${quickInputClass} w-full`}
            />
          </form>
          {results.length > 0 ? (
            <ul className="max-h-28 overflow-y-auto rounded-md border border-border">
              {results.map((m) => {
                const added = present.has(m.symbol);
                return (
                  <li key={m.symbol}>
                    <button
                      type="button"
                      onClick={() => addSymbol(m.symbol)}
                      disabled={added}
                      className="flex w-full items-center justify-between gap-2 px-2 py-1 text-left text-sm outline-none transition-colors hover:bg-accent focus-visible:bg-accent disabled:opacity-40"
                    >
                      <span className="truncate text-foreground">{m.name}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {added ? "추가됨" : "추가"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">검색 결과가 없습니다.</p>
          )}
        </div>
      )}
    </QuickAdd>
  );
}

export default StockCompactView;
