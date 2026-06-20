"use client";

/**
 * todo · CompactView — checklist preview + progress (설계서 §2.2).
 *
 *  Renders PURELY from `config`. Per the frozen contract CompactView has no
 *  onChange, so the checkboxes are READ-ONLY status indicators (done state) —
 *  toggling/editing happens in the ConfigEditor (편집). Progress is conveyed by
 *  BOTH a bar and a "n/total" count, so color is never the only signal.
 */

import * as React from "react";
import type { CompactViewProps } from "@/lib/widgets/contract";
import { computeProgress, type TodoConfig } from "./types";

export function TodoCompactView({ config, density }: CompactViewProps<TodoConfig>) {
  const progress = computeProgress(config.items);
  // Taller/wider tiles show more rows; compact shows fewer.
  const maxRows = density === "compact" ? 3 : density === "cozy" ? 6 : 10;
  const shown = config.items.slice(0, maxRows);
  const hidden = config.items.length - shown.length;

  return (
    <div className="flex h-full w-full flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-sm font-semibold text-foreground">
          {config.title || "할 일"}
        </span>
        <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
          {progress.done}/{progress.total}
        </span>
      </div>

      {/* Progress bar — paired with the numeric count above (not color-only). */}
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={progress.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`완료 ${progress.percent}%`}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${progress.percent}%` }}
        />
      </div>

      {config.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          할 일이 없습니다. 편집에서 추가하세요.
        </p>
      ) : (
        <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
          {shown.map((it) => (
            <li key={it.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={it.done}
                readOnly
                disabled
                aria-label={it.text || "할 일"}
                className="size-4 shrink-0 accent-[var(--primary)]"
              />
              <span
                className={[
                  "min-w-0 flex-1 truncate text-sm",
                  it.done
                    ? "text-muted-foreground line-through"
                    : "text-foreground",
                ].join(" ")}
              >
                {it.text || "(빈 항목)"}
              </span>
            </li>
          ))}
          {hidden > 0 ? (
            <li className="text-xs text-muted-foreground">+{hidden}개 더</li>
          ) : null}
        </ul>
      )}
    </div>
  );
}

export default TodoCompactView;
