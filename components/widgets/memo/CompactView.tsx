"use client";

/**
 * memo · CompactView — INLINE-EDITABLE note. The body is a textarea bound to
 * `config.text`: put the cursor in and type to edit right on the tile (요구:
 * 현재 위치에서 바로 수정). Edits persist via the widget-persistence context
 * (debounced; flushed on blur). The left rail carries the accent color.
 */

import * as React from "react";
import { Lock } from "lucide-react";
import type { CompactViewProps } from "@/lib/widgets/contract";
import {
  MEMO_COLORS,
  MEMO_SIZE_CLASS,
  MEMO_TITLE_CLASS,
  type MemoConfig,
} from "./types";
import { MemoLockPrompt, useMemoLock } from "./MemoLock";
import { useMemoText } from "./useMemoText";

export function MemoCompactView({
  config,
  instanceId,
}: CompactViewProps<MemoConfig>) {
  const { locked, hasLock, lock, tryUnlock } = useMemoLock(config);
  const accent = MEMO_COLORS[config.color]?.swatch ?? MEMO_COLORS.default.swatch;
  const hasAccent = config.color !== "default";
  const { ref: textRef, onChange, onBlur } = useMemoText<HTMLTextAreaElement>(
    instanceId,
    config,
  );
  // 제목은 헤더와 같은 config.title — 어느 쪽에서 고쳐도 서로 반영된다.
  // (구조 분해: react-hooks v6 `refs` 규칙이 훅 반환 객체의 멤버 접근을 오탐한다)
  const {
    ref: titleRef,
    defaultValue: titleValue,
    onChange: onTitleChange,
    onBlur: onTitleBlur,
  } = useMemoText<HTMLInputElement>(instanceId, config, "title");

  if (locked) return <MemoLockPrompt tryUnlock={tryUnlock} size="compact" />;

  return (
    <div className="flex h-full w-full flex-col gap-1">
      {/* 잠금이 설정된(그러나 해제된) 메모에만 '지금 잠금' 버튼 노출. */}
      {hasLock ? (
        <div className="flex shrink-0 items-center justify-end">
          <button
            type="button"
            onClick={lock}
            title="지금 잠금"
            aria-label="지금 잠금"
            data-pb-no-drag=""
            className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Lock size={12} aria-hidden /> 잠금
          </button>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 gap-2">
        {hasAccent ? (
          <span
            aria-hidden
            className="w-1 shrink-0 rounded-full"
            style={{ backgroundColor: accent }}
          />
        ) : null}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-0.5">
        {/* 제목 — 본문보다 한 단계 큰 글씨. 위젯 헤더 제목과 같은 값을 쓴다. */}
        <input
          ref={titleRef}
          type="text"
          defaultValue={titleValue}
          onChange={onTitleChange}
          onBlur={onTitleBlur}
          placeholder="제목"
          spellCheck={false}
          data-pb-no-drag=""
          aria-label="메모 제목"
          style={config.textColor ? { color: config.textColor } : undefined}
          className={[
            "w-full shrink-0 truncate bg-transparent font-semibold outline-none",
            "text-foreground placeholder:font-normal placeholder:italic placeholder:text-muted-foreground",
            MEMO_TITLE_CLASS[config.size],
          ].join(" ")}
        />
        <textarea
          // Uncontrolled (defaultValue) so optimistic config updates don't reset
          // the caret mid-typing; useMemoText syncs external edits when unfocused.
          ref={textRef}
          defaultValue={config.text}
          onChange={onChange}
          onBlur={onBlur}
          placeholder="여기에 메모를 입력하세요…"
          spellCheck={false}
          data-pb-no-drag=""
          // Unset textColor → text-foreground class (테마 자동). A concrete color
          // is applied inline and overrides the class.
          style={config.textColor ? { color: config.textColor } : undefined}
          className={[
            "min-h-0 min-w-0 flex-1 resize-none bg-transparent leading-relaxed outline-none",
            "text-foreground placeholder:italic placeholder:text-muted-foreground",
            "[scrollbar-width:thin]",
            MEMO_SIZE_CLASS[config.size],
          ].join(" ")}
        />
        </div>
      </div>
    </div>
  );
}

export default MemoCompactView;
