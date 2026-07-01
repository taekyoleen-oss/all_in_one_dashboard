"use client";

/**
 * stock · QuoteRow — one symbol's live line: name + price + change.
 *
 *  Direction is shown by color AND the ▲/▼/— arrow AND a `data-direction`
 *  attribute (so it's never color-only). A subtle tick-flash tints the row on
 *  change, disabled under prefers-reduced-motion (useFlash). When no quote has
 *  resolved yet (or the symbol errored) it shows a "—" placeholder.
 */

import * as React from "react";
import type { StockQuote } from "@/output/api-shapes";
import {
  directionOf,
  directionColorClass,
  directionArrow,
  formatPrice,
  formatChange,
  formatPct,
  quoteInfoUrl,
} from "./format";
import { useFlash } from "./useFlash";
import { Sparkline } from "./Sparkline";

const FLASH_CLASS: Record<"up" | "down", string> = {
  up: "bg-[var(--positive)]/10",
  down: "bg-[var(--negative)]/10",
};

export function QuoteRow({
  symbol,
  name,
  quote,
  history,
  size = "compact",
  showSparkline = false,
}: {
  symbol: string;
  /** Fallback display name when no quote has resolved yet. */
  name: string;
  quote: StockQuote | undefined;
  history?: number[];
  size?: "compact" | "expanded";
  showSparkline?: boolean;
}) {
  const price = quote?.price ?? 0;
  const flash = useFlash(price);
  const dir = quote ? directionOf(quote) : "flat";
  const big = size === "expanded";

  const priceText = quote ? formatPrice(quote.price, quote.currency) : "—";
  const changeText = quote
    ? `${directionArrow(dir)} ${formatChange(quote.change)} (${formatPct(quote.changePct)})`
    : "데이터 없음";

  return (
    <li
      data-direction={dir}
      className={[
        "rounded-md transition-colors duration-500",
        flash ? FLASH_CLASS[flash] : "bg-transparent",
      ].join(" ")}
    >
      <a
        href={quoteInfoUrl(symbol)}
        target="_blank"
        rel="noopener noreferrer"
        // 요구: 한 번 클릭은 무시하고, 더블클릭해야 종목 정보로 이동한다.
        onClick={(e) => {
          // 보조 키(Ctrl/⌘/Shift)·가운데 클릭은 브라우저 기본 동작(새 탭 등)을 유지.
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
        }}
        onDoubleClick={() => {
          window.open(quoteInfoUrl(symbol), "_blank", "noopener,noreferrer");
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            window.open(quoteInfoUrl(symbol), "_blank", "noopener,noreferrer");
          }
        }}
        title={`${quote?.name || name} 주식정보 보기 (더블클릭 · 네이버 금융, 새 탭)`}
        className="flex items-center justify-between gap-3 rounded-md px-1.5 py-1 hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
      <div className="flex min-w-0 flex-col">
        <span
          className={[
            "truncate font-medium text-foreground",
            big ? "text-base" : "text-sm",
          ].join(" ")}
        >
          {quote?.name || name}
          {quote?.isIndex ? (
            <span className="ml-1 align-middle text-[10px] text-muted-foreground">
              지수
            </span>
          ) : null}
        </span>
        <span className="truncate text-[11px] text-muted-foreground">
          {symbol}
        </span>
      </div>

      {showSparkline && history && history.length >= 2 ? (
        <Sparkline
          points={history}
          direction={dir}
          width={big ? 88 : 64}
          height={big ? 28 : 22}
          className="shrink-0"
        />
      ) : null}

      <div className="flex shrink-0 flex-col items-end">
        <span
          suppressHydrationWarning
          className={[
            "font-mono font-semibold tabular-nums text-foreground",
            big ? "text-lg" : "text-sm @[240px]/widget:text-base",
          ].join(" ")}
        >
          {priceText}
        </span>
        <span
          className={[
            "font-mono tabular-nums",
            big ? "text-sm" : "text-[11px]",
            directionColorClass(dir),
          ].join(" ")}
        >
          {changeText}
        </span>
      </div>
      </a>
    </li>
  );
}

export default QuoteRow;
