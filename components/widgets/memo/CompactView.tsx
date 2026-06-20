"use client";

/**
 * memo · CompactView — clamped text preview that renders PURELY from `config`.
 *
 *  @container responsive font (font bucket × @container breakpoint). The left
 *  rail carries the accent color, but color is NEVER the only signal — the text
 *  itself is the content, so an empty memo shows a neutral placeholder.
 */

import * as React from "react";
import type { CompactViewProps } from "@/lib/widgets/contract";
import { MEMO_COLORS, MEMO_SIZE_CLASS, type MemoConfig } from "./types";

export function MemoCompactView({ config, density }: CompactViewProps<MemoConfig>) {
  const accent = MEMO_COLORS[config.color]?.swatch ?? MEMO_COLORS.default.swatch;
  const hasAccent = config.color !== "default";
  // Line clamp scales with density so taller/wider tiles show more lines.
  const clampClass =
    density === "compact"
      ? "line-clamp-3"
      : density === "cozy"
        ? "line-clamp-6"
        : "line-clamp-[12]";

  return (
    <div className="flex h-full w-full gap-2">
      {hasAccent ? (
        <span
          aria-hidden
          className="w-1 shrink-0 rounded-full"
          style={{ backgroundColor: accent }}
        />
      ) : null}
      {config.text.trim() ? (
        <p
          className={[
            "min-w-0 flex-1 whitespace-pre-wrap break-words leading-relaxed text-foreground",
            MEMO_SIZE_CLASS[config.size],
            clampClass,
          ].join(" ")}
        >
          {config.text}
        </p>
      ) : (
        <p className="min-w-0 flex-1 text-sm italic text-muted-foreground">
          빈 메모입니다. 편집해서 내용을 추가하세요.
        </p>
      )}
    </div>
  );
}

export default MemoCompactView;
