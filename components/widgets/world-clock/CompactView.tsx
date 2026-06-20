"use client";

/**
 * world-clock · CompactView — live list of timezone times (설계서 §2.2).
 *
 *  Updates every second (useNow). Time nodes carry `suppressHydrationWarning`
 *  because the server-rendered clock differs from the client's by design (same
 *  approach as the demo clock). Client-only — Intl.DateTimeFormat with timeZone,
 *  no external API.
 */

import * as React from "react";
import type { CompactViewProps } from "@/lib/widgets/contract";
import { useNow } from "@/lib/utils/useNow";
import { formatZone } from "./format";
import type { WorldClockConfig } from "./types";

export function WorldClockCompactView({
  config,
  density,
}: CompactViewProps<WorldClockConfig>) {
  const now = useNow(1000);
  const timeSize =
    density === "compact"
      ? "text-base"
      : "text-lg @[260px]/widget:text-xl";

  if (config.zones.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        시간대가 없습니다. 편집에서 추가하세요.
      </p>
    );
  }

  return (
    <ul className="flex h-full flex-col justify-center gap-1.5">
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
  );
}

export default WorldClockCompactView;
