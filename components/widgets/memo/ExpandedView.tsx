"use client";

/**
 * memo · ExpandedView — full-screen readable rendering of the memo (설계서 §2.1).
 *
 *  Contract note: ExpandedView(config, instanceId) has NO onChange — the frozen
 *  contract routes persistence through ConfigEditor (편집 dialog) only. So focus
 *  mode presents the memo at a comfortable reading size with a *view-only*
 *  font-size control (a local preference, not persisted), and points the user to
 *  편집 for changing the content. This keeps us strictly on-contract while still
 *  honoring the spec's "전체 편집 · 글자 크기" intent (size persists via Config).
 */

import * as React from "react";
import type { ExpandedViewProps } from "@/lib/widgets/contract";
import {
  MEMO_COLORS,
  MEMO_SIZE_CLASS_EXPANDED,
  type MemoConfig,
  type MemoSize,
} from "./types";

const SIZE_ORDER: MemoSize[] = ["sm", "md", "lg"];
const SIZE_LABEL: Record<MemoSize, string> = { sm: "작게", md: "보통", lg: "크게" };

export function MemoExpandedView({ config }: ExpandedViewProps<MemoConfig>) {
  // View-only override of the rendered size (does NOT mutate config). Seeded from
  // config.size during render via initializer — no setState-in-effect.
  const [viewSize, setViewSize] = React.useState<MemoSize>(config.size);
  const accent = MEMO_COLORS[config.color]?.swatch ?? MEMO_COLORS.default.swatch;
  const hasAccent = config.color !== "default";

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-end gap-1">
        <span className="mr-1 text-xs text-muted-foreground">글자 크기</span>
        <div
          role="group"
          aria-label="글자 크기"
          className="inline-flex overflow-hidden rounded-md border border-border"
        >
          {SIZE_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={viewSize === s}
              onClick={() => setViewSize(s)}
              className={[
                "px-2.5 py-1 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                viewSize === s
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/60",
              ].join(" ")}
            >
              {SIZE_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-3">
        {hasAccent ? (
          <span
            aria-hidden
            className="w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: accent }}
          />
        ) : null}
        {config.text.trim() ? (
          <p
            className={[
              "min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words leading-relaxed text-foreground",
              MEMO_SIZE_CLASS_EXPANDED[viewSize],
            ].join(" ")}
          >
            {config.text}
          </p>
        ) : (
          <p className="flex-1 text-sm italic text-muted-foreground">
            빈 메모입니다. 헤더의 ⋮ 메뉴에서 편집을 눌러 내용을 추가하세요.
          </p>
        )}
      </div>

      <p className="shrink-0 text-xs text-muted-foreground">
        내용·색상·기본 크기를 바꾸려면 위젯 메뉴의 “편집”을 사용하세요.
      </p>
    </div>
  );
}

export default MemoExpandedView;
