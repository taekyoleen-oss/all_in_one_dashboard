"use client";

/**
 * dday · ExpandedView — full list of countdowns, large (설계서 §2.2).
 *
 *  Managing entries flows through ConfigEditor (편집) per the frozen contract
 *  (no onChange here) — a hint points there. Tone uses color + D-/D+ symbol.
 */

import * as React from "react";
import type { ExpandedViewProps } from "@/lib/widgets/contract";
import { useNow } from "@/lib/utils/useNow";
import { computeDDay } from "./compute";
import type { DDayConfig } from "./types";

const TONE_CLASS: Record<string, string> = {
  future: "text-primary",
  today: "text-positive",
  past: "text-muted-foreground",
};

export function DDayExpandedView({ config }: ExpandedViewProps<DDayConfig>) {
  const now = useNow(60_000);

  if (config.entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        D-Day가 없습니다. 위젯 메뉴의 “편집”에서 추가하세요.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {config.entries.map((e) => {
          const r = computeDDay(e, now);
          return (
            <li
              key={e.id}
              className="flex items-center justify-between gap-4 rounded-[var(--radius)] border border-border bg-card/60 p-4"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-base font-medium text-foreground">
                  {e.label || "(제목 없음)"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {r.targetText}
                  {e.repeatYearly ? " · 매년 반복" : ""}
                </span>
              </div>
              <span
                className={[
                  "shrink-0 font-mono text-3xl font-semibold tabular-nums",
                  TONE_CLASS[r.tone],
                ].join(" ")}
              >
                {r.label}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">
        항목 추가·삭제·순서 변경은 위젯 메뉴의 “편집”에서 할 수 있습니다.
      </p>
    </div>
  );
}

export default DDayExpandedView;
