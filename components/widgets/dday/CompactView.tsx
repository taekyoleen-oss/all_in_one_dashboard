"use client";

/**
 * dday · CompactView — countdown(s) to target date(s) (설계서 §2.2).
 *
 *  Shows each entry's "D-12" / "D+3" / "D-Day" badge. Recomputes at midnight via
 *  a slow tick (useNow at 60s is plenty for day-resolution). Tone is conveyed by
 *  BOTH color and the D-/D+ symbol, so color is never the only signal.
 */

import * as React from "react";
import type { CompactViewProps } from "@/lib/widgets/contract";
import { useNow } from "@/lib/utils/useNow";
import { computeDDay } from "./compute";
import type { DDayConfig } from "./types";

const TONE_CLASS: Record<string, string> = {
  future: "text-primary",
  today: "text-positive",
  past: "text-muted-foreground",
};

export function DDayCompactView({ config, density }: CompactViewProps<DDayConfig>) {
  // Day-resolution: tick once a minute so it flips at midnight without churn.
  const now = useNow(60_000);
  const big = density !== "compact";

  if (config.entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        D-Day가 없습니다. 편집에서 추가하세요.
      </p>
    );
  }

  return (
    <ul className="flex h-full flex-col justify-center gap-2">
      {config.entries.map((e) => {
        const r = computeDDay(e, now);
        return (
          <li key={e.id} className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium text-foreground">
                {e.label || "(제목 없음)"}
                {e.repeatYearly ? (
                  <span className="ml-1 align-middle text-[10px] text-muted-foreground">
                    매년
                  </span>
                ) : null}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {r.targetText}
              </span>
            </div>
            <span
              className={[
                "shrink-0 font-mono font-semibold tabular-nums",
                big ? "text-xl @[260px]/widget:text-2xl" : "text-lg",
                TONE_CLASS[r.tone],
              ].join(" ")}
            >
              {r.label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export default DDayCompactView;
