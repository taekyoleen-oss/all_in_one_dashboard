"use client";

/**
 * todo · ExpandedView — full checklist, large (설계서 §2.2).
 *
 *  Renders from `config`; 체크박스는 여기서 바로 토글(완료 처리)되며
 *  useSaveWidgetConfig로 즉시 저장한다 — 항목 추가/편집/순서 변경은
 *  ConfigEditor (편집); a hint points there.
 */

import * as React from "react";
import type { ExpandedViewProps } from "@/lib/widgets/contract";
import { useSaveWidgetConfig } from "@/lib/widgets/persistence";
import { computeProgress, type TodoConfig } from "./types";

export function TodoExpandedView({
  config,
  instanceId,
}: ExpandedViewProps<TodoConfig>) {
  const save = useSaveWidgetConfig();
  const progress = computeProgress(config.items);

  // 체크박스 토글 → 해당 항목 done 반전 후 즉시 저장.
  const toggle = (id: string) =>
    save(instanceId, {
      ...config,
      items: config.items.map((it) =>
        it.id === id ? { ...it, done: !it.done } : it,
      ),
    });

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
                onChange={() => toggle(it.id)}
                aria-label={it.text || "할 일"}
                className="size-5 shrink-0 cursor-pointer accent-[var(--primary)]"
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
        항목 추가·수정·순서 변경은 위젯 메뉴의 “편집”에서 할 수 있습니다.
      </p>
    </div>
  );
}

export default TodoExpandedView;
