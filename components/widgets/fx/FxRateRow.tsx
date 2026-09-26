"use client";

/**
 * fx · FxRateRow — one currency pair's rate line (base→quote).
 *
 *  Direction is shown by color AND the ▲/▼/— arrow AND a `data-direction`
 *  attribute (never color-only). The pair (e.g. "USD/KRW") is always visible so
 *  the row reads without color.
 */

import * as React from "react";
import {
  fxDirectionArrow,
  fxDirectionColorClass,
  formatRate,
  formatFxAmount,
} from "./format";
import { fxInfoUrl } from "./rows";
import type { FxRow } from "./useFxRates";

export function FxRateRow({
  row,
  size = "compact",
}: {
  /** base kept optional for call-site compat; display is always 원 기준. */
  base?: string;
  row: FxRow;
  size?: "compact" | "expanded";
}) {
  const big = size === "expanded";
  const href = fxInfoUrl(row.quote);
  const open = () => window.open(href, "_blank", "noopener,noreferrer");
  return (
    <li data-direction={row.direction} className="rounded-md">
      {/* 요구: 주식 행처럼 **더블클릭**하면 그 통화의 환율 정보 페이지로(한 번 클릭은 무시 —
          위젯을 끌어 옮기다 눌리는 자리다). 보조 키·가운데 클릭은 브라우저 기본 동작 유지. */}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
        }}
        onDoubleClick={open}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            open();
          }
        }}
        title={`${row.quote} 환율정보 보기 (더블클릭 · 새 탭)`}
        className="flex items-center justify-between gap-3 rounded-md px-1.5 py-1 hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
      <div className="flex min-w-0 flex-col">
        <span
          className={[
            "truncate font-medium text-foreground",
            big ? "text-base" : "text-sm",
          ].join(" ")}
        >
          {row.unit > 1 ? `${row.unit} ` : ""}
          {row.quote}
        </span>
        <span className="truncate text-[11px] text-muted-foreground">
          {row.unit > 1 ? `${row.unit} ` : "1 "}
          {row.quote} → 원
        </span>
      </div>

      <div className="flex shrink-0 flex-col items-end">
        <div className="flex items-baseline gap-1">
          <span
            className={[
              "font-mono font-semibold tabular-nums text-foreground",
              big ? "text-lg" : "text-sm @[240px]/widget:text-base",
            ].join(" ")}
          >
            {formatRate(row.krw)}
          </span>
          <span className="text-[11px] text-muted-foreground">원</span>
          <span
            aria-hidden
            className={["text-xs", fxDirectionColorClass(row.direction)].join(" ")}
          >
            {fxDirectionArrow(row.direction)}
          </span>
        </div>
        {/* 전일 대비 증감 (signed 금액·원) — color + sign, never color-only. */}
        {formatFxAmount(row.changeAbs) ? (
          <span
            className={[
              "font-mono tabular-nums",
              big ? "text-xs" : "text-[10px]",
              fxDirectionColorClass(row.direction),
            ].join(" ")}
          >
            {formatFxAmount(row.changeAbs)}
            <span className="ml-1 text-muted-foreground">전일대비</span>
          </span>
        ) : null}
      </div>
      </a>
    </li>
  );
}

export default FxRateRow;
