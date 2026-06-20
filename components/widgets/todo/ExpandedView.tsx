"use client";

/**
 * todo · ExpandedView — full checklist, large (설계서 §2.2).
 *
 *  Renders purely from `config`. Per the frozen contract there is no onChange
 *  here, so checkboxes are READ-ONLY status indicators — add/edit/remove/reorder
 *  and toggling flow through the ConfigEditor (편집); a hint points there.
 */

import * as React from "react";
import type { ExpandedViewProps } from "@/lib/widgets/contract";
import { computeProgress, type TodoConfig } from "./types";

export function TodoExpandedView({ config }: ExpandedViewProps<TodoConfig>) {
  const progress = computeProgress(config.items);

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="truncate text-lg font-semibold text-foreground">
            {config.title || "할 일"}
          </h2>
          <span className="shrink-0 font-mono text-sm tabular-nums text-muted-foreground">
            {progress.done}/{progress.total} · {progress.percent}%
          </span>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
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
      </div>

      {config.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          할 일이 없습니다. 위젯 메뉴의 “편집”에서 추가하세요.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {config.items.map((it) => (
            <li
              key={it.id}
              className="flex items-center gap-3 rounded-md border border-border bg-card/60 px-3 py-2"
            >
              <input
                type="checkbox"
                checked={it.done}
                readOnly
                disabled
                aria-label={it.text || "할 일"}
                className="size-5 shrink-0 accent-[var(--primary)]"
              />
              <span
                className={[
                  "min-w-0 flex-1 break-words text-base",
                  it.done
                    ? "text-muted-foreground line-through"
                    : "text-foreground",
                ].join(" ")}
              >
                {it.text || "(빈 항목)"}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">
        항목 추가·완료 체크·순서 변경은 위젯 메뉴의 “편집”에서 할 수 있습니다.
      </p>
    </div>
  );
}

export default TodoExpandedView;
