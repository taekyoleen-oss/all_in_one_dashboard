"use client";

/**
 * fx · FxRateRow — one currency pair's rate line (base→quote).
 *
 *  Direction is shown by color AND the ▲/▼/— arrow AND a `data-direction`
 *  attribute (never color-only). The pair (e.g. "USD/KRW") is always visible so
 *  the row reads without color.
 */

import * as React from "react";
import { fxDirectionArrow, fxDirectionColorClass, formatRate } from "./format";
import type { FxRow } from "./useFxRates";

export function FxRateRow({
  base,
  row,
  size = "compact",
}: {
  base: string;
  row: FxRow;
  size?: "compact" | "expanded";
}) {
  const big = size === "expanded";
  return (
    <li
      data-direction={row.direction}
      className="flex items-center justify-between gap-3 rounded-md px-1.5 py-1"
    >
      <div className="flex min-w-0 flex-col">
        <span
          className={[
            "truncate font-medium text-foreground",
            big ? "text-base" : "text-sm",
          ].join(" ")}
        >
          {base}/{row.quote}
        </span>
        <span className="truncate text-[11px] text-muted-foreground">
          1 {base}
        </span>
      </div>

      <div className="flex shrink-0 items-baseline gap-1.5">
        <span
          className={[
            "font-mono font-semibold tabular-nums text-foreground",
            big ? "text-lg" : "text-sm @[240px]/widget:text-base",
          ].join(" ")}
        >
          {formatRate(row.rate)}
        </span>
        <span
          aria-hidden
          className={["text-xs", fxDirectionColorClass(row.direction)].join(" ")}
        >
          {fxDirectionArrow(row.direction)}
        </span>
      </div>
    </li>
  );
}

export default FxRateRow;
