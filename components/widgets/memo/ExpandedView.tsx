"use client";

/**
 * memo · ExpandedView — full-screen EDITABLE memo (편집=전체 화면 환경, 노트와
 * 동일 UX). The body is the same inline-edit textarea as the tile (useMemoText:
 * uncontrolled + debounced persist via widget-persistence context + external
 * sync). 색상·비밀번호·기본 크기는 '스타일 편집'(ConfigEditor)에서. The
 * font-size control here stays *view-only* (local preference, not persisted).
 */

import * as React from "react";
import { Lock } from "lucide-react";
import type { ExpandedViewProps } from "@/lib/widgets/contract";
import {
  MEMO_COLORS,
  MEMO_SIZE_CLASS_EXPANDED,
  MEMO_TITLE_CLASS_EXPANDED,
  type MemoConfig,
  type MemoSize,
} from "./types";
import { MemoLockPrompt, useMemoLock } from "./MemoLock";
import { useMemoText } from "./useMemoText";

const SIZE_ORDER: MemoSize[] = ["sm", "md", "lg"];
const SIZE_LABEL: Record<MemoSize, string> = { sm: "작게", md: "보통", lg: "크게" };

export function MemoExpandedView({
  config,
  instanceId,
}: ExpandedViewProps<MemoConfig>) {
  const { locked, hasLock, lock, tryUnlock } = useMemoLock(config);
  const { ref: textRef, onChange, onBlur } = useMemoText<HTMLTextAreaElement>(
    instanceId,
    config,
  );
  // 제목은 헤더/전체보기 이름과 같은 config.title — 어느 쪽에서 고쳐도 서로 반영된다.
  // (구조 분해: react-hooks v6 `refs` 규칙이 훅 반환 객체의 멤버 접근을 오탐한다)
  const {
    ref: titleRef,
    defaultValue: titleValue,
    onChange: onTitleChange,
    onBlur: onTitleBlur,
  } = useMemoText<HTMLInputElement>(instanceId, config, "title");
  // View-only override of the rendered size (does NOT mutate config). Seeded from
  // config.size during render via initializer — no setState-in-effect.
  const [viewSize, setViewSize] = React.useState<MemoSize>(config.size);
  const accent = MEMO_COLORS[config.color]?.swatch ?? MEMO_COLORS.default.swatch;
  const hasAccent = config.color !== "default";

  if (locked) return <MemoLockPrompt tryUnlock={tryUnlock} size="expanded" />;

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        {/* 잠금이 설정된(해제 상태) 메모에만 '지금 잠금' 버튼. */}
        {hasLock ? (
          <button
            type="button"
            onClick={lock}
            title="지금 잠금"
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Lock size={13} aria-hidden /> 지금 잠금
          </button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-1">
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
      </div>

      <div className="flex min-h-0 flex-1 gap-3">
        {hasAccent ? (
          <span
            aria-hidden
            className="w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: accent }}
          />
        ) : null}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1">
          {/* 제목 — 본문보다 한 단계 큰 글씨. 위젯 헤더 제목과 같은 값. */}
          <input
            ref={titleRef}
            type="text"
            defaultValue={titleValue}
            onChange={onTitleChange}
            onBlur={onTitleBlur}
            placeholder="제목"
            spellCheck={false}
            aria-label="메모 제목"
            style={config.textColor ? { color: config.textColor } : undefined}
            className={[
              "w-full shrink-0 bg-transparent font-semibold outline-none",
              "text-foreground placeholder:font-normal placeholder:italic placeholder:text-muted-foreground",
              MEMO_TITLE_CLASS_EXPANDED[viewSize],
            ].join(" ")}
          />
          <textarea
            // Uncontrolled (caret-safe); useMemoText persists (debounced) and
            // syncs external edits when unfocused. textColor unset → 테마 자동.
            ref={textRef}
            defaultValue={config.text}
            onChange={onChange}
            onBlur={onBlur}
            placeholder="여기에 메모를 입력하세요…"
            spellCheck={false}
            style={config.textColor ? { color: config.textColor } : undefined}
            className={[
              "min-h-0 min-w-0 flex-1 resize-none bg-transparent leading-relaxed outline-none",
              "text-foreground placeholder:italic placeholder:text-muted-foreground",
              MEMO_SIZE_CLASS_EXPANDED[viewSize],
            ].join(" ")}
          />
        </div>
      </div>

      <p className="shrink-0 text-xs text-muted-foreground">
        색상·글자 색·기본 크기·비밀번호는 ⋮ 메뉴의 “스타일 편집”에서 바꿀 수
        있어요.
      </p>
    </div>
  );
}

export default MemoExpandedView;
