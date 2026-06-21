"use client";

/**
 * fx · CompactView — currency-pair rates on the canvas tile (설계서 §2.2).
 *
 *  Polls /api/fx via useFxRates (keyless Frankfurter source). Each row shows the
 *  pair + rate with a direction arrow (color is never the only signal). Reflows
 *  by @container width; the base/quotes come from this instance's config (격리).
 */

import * as React from "react";
import type { CompactViewProps } from "@/lib/widgets/contract";
import { RefreshBar } from "@/components/widgets/shared/RefreshBar";
import { FxRateRow } from "./FxRateRow";
import { useFxRates } from "./useFxRates";
import type { FxConfig } from "./types";

export function FxCompactView({ config }: CompactViewProps<FxConfig>) {
  const { base, rows, stale, loading, error, lastUpdated, refresh } = useFxRates(
    config.base,
    config.quotes,
  );

  if (config.quotes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        통화쌍이 없습니다. 편집에서 통화를 추가하세요.
      </p>
    );
  }

  if (loading && rows.length === 0) {
    return <p className="text-sm text-muted-foreground">환율 불러오는 중…</p>;
  }

  if (error && rows.length === 0) {
    return <p className="text-sm text-muted-foreground">환율을 불러오지 못했습니다.</p>;
  }

  return (
    <div className="flex h-full flex-col gap-1">
      <RefreshBar lastUpdated={lastUpdated} onRefresh={refresh} size="compact" />
      <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pb-scroll">
        {rows.map((row) => (
          <FxRateRow key={row.quote} base={base} row={row} size="compact" />
        ))}
      </ul>
      {stale ? (
        <p className="shrink-0 text-right text-[10px] text-muted-foreground">
          기준환율(일별)
        </p>
      ) : null}
    </div>
  );
}

export default FxCompactView;
