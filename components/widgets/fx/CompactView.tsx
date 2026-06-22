"use client";

/**
 * fx · CompactView — currency-pair rates on the canvas tile (설계서 §2.2).
 *
 *  Polls /api/fx via useFxRates(네이버 고시환율, Frankfurter 폴백). 각 행은 원화
 *  환산값 + 방향 화살표. 타일 하단 QuickAdd로 통화를 드롭다운에서 골라 추가한다.
 */

import * as React from "react";
import type { CompactViewProps } from "@/lib/widgets/contract";
import { useSaveWidgetConfig } from "@/lib/widgets/persistence";
import {
  QuickAdd,
  quickInputClass,
  quickBtnClass,
} from "@/components/widgets/shared/QuickAdd";
import { RefreshBar } from "@/components/widgets/shared/RefreshBar";
import { FxRateRow } from "./FxRateRow";
import { useFxRates } from "./useFxRates";
import {
  COMMON_CURRENCIES,
  foreignCurrencies,
  type FxConfig,
} from "./types";

export function FxCompactView({
  config,
  instanceId,
}: CompactViewProps<FxConfig>) {
  const { base, rows, stale, loading, error, lastUpdated, refresh } = useFxRates(
    config.base,
    config.quotes,
  );

  let body: React.ReactNode;
  if (config.quotes.length === 0) {
    body = <p className="text-sm text-muted-foreground">통화가 없습니다.</p>;
  } else if (loading && rows.length === 0) {
    body = <p className="text-sm text-muted-foreground">환율 불러오는 중…</p>;
  } else if (error && rows.length === 0) {
    body = (
      <p className="text-sm text-muted-foreground">환율을 불러오지 못했습니다.</p>
    );
  } else {
    body = (
      <>
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
      </>
    );
  }

  return (
    <div className="flex h-full flex-col gap-1">
      {body}
      <FxQuickAdd config={config} instanceId={instanceId} />
    </div>
  );
}

/** 타일 하단 빠른 추가: 자주 쓰는 통화 드롭다운(원화·이미 추가된 통화 제외). */
function FxQuickAdd({
  config,
  instanceId,
}: {
  config: FxConfig;
  instanceId: string;
}) {
  const save = useSaveWidgetConfig();
  const present = new Set([
    "KRW",
    ...foreignCurrencies(config).map((c) => c.toUpperCase()),
  ]);
  const options = COMMON_CURRENCIES.filter(
    (c) => !present.has(c.code.toUpperCase()),
  );
  const [code, setCode] = React.useState("");

  const add = () => {
    const c = code.trim().toUpperCase();
    if (!c) return;
    save(instanceId, { ...config, quotes: [...config.quotes, c] });
    setCode("");
  };

  return (
    <QuickAdd label="통화 추가">
      {() => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
          className="flex items-center gap-1.5"
        >
          <select
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            aria-label="통화 선택"
            className={`${quickInputClass} flex-1`}
          >
            <option value="">통화 선택…</option>
            {options.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label} ({c.code})
              </option>
            ))}
          </select>
          <button type="submit" disabled={!code} className={quickBtnClass}>
            추가
          </button>
        </form>
      )}
    </QuickAdd>
  );
}

export default FxCompactView;
