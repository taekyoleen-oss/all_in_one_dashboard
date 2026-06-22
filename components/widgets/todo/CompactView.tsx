"use client";

/**
 * todo · CompactView — checklist preview + progress (설계서 §2.2).
 *
 *  Renders from `config`; checkboxes are READ-ONLY status (toggling/editing in the
 *  ConfigEditor). 타일 하단의 QuickAdd로 새 할 일을 바로 추가할 수 있다(저장은
 *  useSaveWidgetConfig). Progress is BOTH a bar and a count (never color-only).
 */

import * as React from "react";
import type { CompactViewProps } from "@/lib/widgets/contract";
import { useSaveWidgetConfig } from "@/lib/widgets/persistence";
import {
  QuickAdd,
  newItemId,
  quickInputClass,
} from "@/components/widgets/shared/QuickAdd";
import { computeProgress, type TodoConfig } from "./types";

export function TodoCompactView({
  config,
  instanceId,
  density,
}: CompactViewProps<TodoConfig>) {
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
        <p className="text-sm text-muted-foreground">할 일이 없습니다.</p>
      ) : (
        <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pb-scroll">
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

      <TodoQuickAdd config={config} instanceId={instanceId} />
    </div>
  );
}

/** 타일 하단 빠른 추가: 할 일 텍스트 한 줄. 추가 후 입력만 비워 연속 추가 가능. */
function TodoQuickAdd({
  config,
  instanceId,
}: {
  config: TodoConfig;
  instanceId: string;
}) {
  const save = useSaveWidgetConfig();
  const [text, setText] = React.useState("");
  const add = () => {
    const t = text.trim();
    if (!t) return;
    save(instanceId, {
      ...config,
      items: [...config.items, { id: newItemId("t"), text: t, done: false }],
    });
    setText("");
  };
  return (
    <QuickAdd label="할 일 추가">
      {() => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
          className="flex items-center gap-1.5"
        >
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="할 일 입력"
            className={`${quickInputClass} flex-1`}
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="shrink-0 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
          >
            추가
          </button>
        </form>
      )}
    </QuickAdd>
  );
}

export default TodoCompactView;
