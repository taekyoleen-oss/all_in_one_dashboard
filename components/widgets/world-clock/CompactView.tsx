"use client";

/**
 * world-clock · CompactView — live list of timezone times (설계서 §2.2).
 *
 *  Updates every second (useNow). Client-only — Intl.DateTimeFormat with timeZone.
 *  타일 하단 QuickAdd로 도시(시간대)를 드롭다운에서 골라 바로 추가한다.
 */

import * as React from "react";
import type { CompactViewProps } from "@/lib/widgets/contract";
import { useNow } from "@/lib/utils/useNow";
import { useSaveWidgetConfig } from "@/lib/widgets/persistence";
import {
  QuickAdd,
  newItemId,
  quickInputClass,
  quickBtnClass,
} from "@/components/widgets/shared/QuickAdd";
import { formatZone } from "./format";
import { COMMON_ZONES, type WorldClockConfig } from "./types";

export function WorldClockCompactView({
  config,
  instanceId,
  density,
}: CompactViewProps<WorldClockConfig>) {
  const now = useNow(1000);
  const timeSize =
    density === "compact" ? "text-base" : "text-lg @[260px]/widget:text-xl";

  return (
    <div className="flex h-full w-full flex-col gap-1.5">
      {config.zones.length === 0 ? (
        <p className="text-sm text-muted-foreground">시간대가 없습니다.</p>
      ) : (
        <ul className="flex min-h-0 flex-1 flex-col justify-center gap-1.5 overflow-y-auto pb-scroll">
          {config.zones.map((z) => {
            const r = formatZone(now, z.timeZone, config);
            return (
              <li
                key={z.id}
                className="flex items-baseline justify-between gap-3 border-b border-border/50 pb-1 last:border-0 last:pb-0"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium text-foreground">
                    {z.label}
                  </span>
                  {density !== "compact" && r.offset ? (
                    <span className="truncate text-xs text-muted-foreground">
                      {r.offset} · {r.date}
                    </span>
                  ) : null}
                </div>
                <span
                  suppressHydrationWarning
                  className={[
                    "shrink-0 font-mono tabular-nums text-foreground",
                    timeSize,
                  ].join(" ")}
                >
                  {r.time}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <WorldClockQuickAdd config={config} instanceId={instanceId} />
    </div>
  );
}

/** 타일 하단 빠른 추가: 자주 쓰는 도시 드롭다운에서 선택(이미 있는 시간대는 제외). */
function WorldClockQuickAdd({
  config,
  instanceId,
}: {
  config: WorldClockConfig;
  instanceId: string;
}) {
  const save = useSaveWidgetConfig();
  const present = new Set(config.zones.map((z) => z.timeZone));
  const options = COMMON_ZONES.filter((z) => !present.has(z.timeZone));
  const [tz, setTz] = React.useState("");

  const add = () => {
    const picked = COMMON_ZONES.find((z) => z.timeZone === tz);
    if (!picked) return;
    save(instanceId, {
      ...config,
      zones: [
        ...config.zones,
        { id: newItemId("z"), timeZone: picked.timeZone, label: picked.label },
      ],
    });
    setTz("");
  };

  return (
    <QuickAdd label="도시 추가">
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
            value={tz}
            onChange={(e) => setTz(e.target.value)}
            aria-label="도시 선택"
            className={`${quickInputClass} flex-1`}
          >
            <option value="">도시 선택…</option>
            {options.map((z) => (
              <option key={z.timeZone} value={z.timeZone}>
                {z.label}
              </option>
            ))}
          </select>
          <button type="submit" disabled={!tz} className={quickBtnClass}>
            추가
          </button>
        </form>
      )}
    </QuickAdd>
  );
}

export default WorldClockCompactView;
