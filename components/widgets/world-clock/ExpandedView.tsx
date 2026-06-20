"use client";

/**
 * world-clock · ExpandedView — large live clocks for every zone (설계서 §2.2).
 *
 *  Focus mode shows each zone big with date + offset, updating each second.
 *  Managing zones (add/remove/reorder) flows through the ConfigEditor (편집), per
 *  the frozen contract (ExpandedView has no onChange) — a hint points there.
 */

import * as React from "react";
import type { ExpandedViewProps } from "@/lib/widgets/contract";
import { useNow } from "@/lib/utils/useNow";
import { formatZone } from "./format";
import type { WorldClockConfig } from "./types";

export function WorldClockExpandedView({
  config,
}: ExpandedViewProps<WorldClockConfig>) {
  const now = useNow(1000);

  if (config.zones.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        시간대가 없습니다. 위젯 메뉴의 “편집”에서 추가하세요.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 @[640px]/focus:grid-cols-3">
        {config.zones.map((z) => {
          const r = formatZone(now, z.timeZone, config);
          return (
            <div
              key={z.id}
              className="flex flex-col gap-1 rounded-[var(--radius)] border border-border bg-card/60 p-4"
            >
              <span className="text-sm font-medium text-muted-foreground">
                {z.label}
              </span>
              <span
                suppressHydrationWarning
                className="font-mono text-3xl tabular-nums text-foreground"
              >
                {r.time}
              </span>
              <span className="text-xs text-muted-foreground">
                {r.date}
                {r.offset ? ` · ${r.offset}` : ""}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        시간대 추가·삭제·순서 변경은 위젯 메뉴의 “편집”에서 할 수 있습니다.
      </p>
    </div>
  );
}

export default WorldClockExpandedView;
