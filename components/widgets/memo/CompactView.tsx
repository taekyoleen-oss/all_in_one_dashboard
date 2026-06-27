"use client";

/**
 * memo · CompactView — INLINE-EDITABLE note. The body is a textarea bound to
 * `config.text`: put the cursor in and type to edit right on the tile (요구:
 * 현재 위치에서 바로 수정). Edits persist via the widget-persistence context
 * (debounced; flushed on blur). The left rail carries the accent color.
 */

import * as React from "react";
import type { CompactViewProps } from "@/lib/widgets/contract";
import { useSaveWidgetConfig } from "@/lib/widgets/persistence";
import { MEMO_COLORS, MEMO_SIZE_CLASS, type MemoConfig } from "./types";

export function MemoCompactView({
  config,
  instanceId,
}: CompactViewProps<MemoConfig>) {
  const save = useSaveWidgetConfig();
  const accent = MEMO_COLORS[config.color]?.swatch ?? MEMO_COLORS.default.swatch;
  const hasAccent = config.color !== "default";

  // Latest config in a ref so the debounced save always merges the current
  // color/size, not a stale closure.
  const configRef = React.useRef(config);
  configRef.current = config;
  const timer = React.useRef<number | null>(null);

  const persist = React.useCallback(
    (text: string, debounce: boolean) => {
      if (timer.current != null) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
      const run = () => save(instanceId, { ...configRef.current, text });
      if (debounce) timer.current = window.setTimeout(run, 500);
      else run();
    },
    [instanceId, save],
  );

  React.useEffect(
    () => () => {
      if (timer.current != null) window.clearTimeout(timer.current);
    },
    [],
  );

  return (
    <div className="flex h-full w-full gap-2">
      {hasAccent ? (
        <span
          aria-hidden
          className="w-1 shrink-0 rounded-full"
          style={{ backgroundColor: accent }}
        />
      ) : null}
      <textarea
        // Uncontrolled (defaultValue) so optimistic config updates don't reset
        // the caret mid-typing; keyed by instanceId via the parent remount.
        defaultValue={config.text}
        onChange={(e) => persist(e.target.value, true)}
        onBlur={(e) => persist(e.target.value, false)}
        placeholder="여기에 메모를 입력하세요…"
        spellCheck={false}
        data-pb-no-drag=""
        // Unset textColor → text-foreground class (테마 자동). A concrete color
        // is applied inline and overrides the class.
        style={config.textColor ? { color: config.textColor } : undefined}
        className={[
          "min-w-0 flex-1 resize-none bg-transparent leading-relaxed outline-none",
          "text-foreground placeholder:italic placeholder:text-muted-foreground",
          "[scrollbar-width:thin]",
          MEMO_SIZE_CLASS[config.size],
        ].join(" ")}
      />
    </div>
  );
}

export default MemoCompactView;
