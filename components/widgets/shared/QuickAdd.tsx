"use client";

/**
 * QuickAdd — 위젯 타일 하단의 "간단히 추가" 푸터.
 *
 *  접힌 상태: 점선 "+ 추가" 버튼(전체폭). 펼친 상태: 위젯이 넘긴 미니 입력 폼 +
 *  닫기(X). 위젯의 CompactView가 이 컴포넌트를 목록 아래에 두고, children에 자기
 *  필드 폼을 렌더한다(폼이 useSaveWidgetConfig로 직접 저장). 추가 후에는 폼을 열어
 *  둔 채 입력만 비워 연속 추가가 쉽도록 한다(닫기는 X).
 *
 *  shrink-0이라 목록이 스크롤돼도 항상 타일 맨 아래에 고정된다.
 */

import * as React from "react";
import { Plus, X } from "lucide-react";

/** 짧은 안정 id 생성(목록 key + 순서용). */
export function newItemId(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${rand}`;
}

/** 미니 입력에 공통으로 쓰는 인풋 클래스. */
export const quickInputClass =
  "min-w-0 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** 미니 폼의 "추가" 제출 버튼 공통 클래스. */
export const quickBtnClass =
  "shrink-0 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40";

export function QuickAdd({
  label = "추가",
  children,
}: {
  label?: string;
  /** 펼친 폼. close()를 호출하면 다시 접힌다(보통은 호출하지 않고 입력만 비움). */
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);

  if (!open) {
    // 여백 최소화(요구: 타일 하단 공백 축소) — 얇은 한 줄 버튼(py-0.5)·좁은 마진.
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-0.5 flex w-full shrink-0 items-center justify-center gap-1 rounded-md border border-dashed border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Plus size={12} aria-hidden /> {label}
      </button>
    );
  }

  return (
    <div className="mt-0.5 shrink-0 rounded-md border border-border bg-background/40 p-1">
      <div className="flex items-start gap-1.5">
        <div className="min-w-0 flex-1">{children(close)}</div>
        <button
          type="button"
          aria-label="추가 닫기"
          onClick={close}
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:size-9"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

export default QuickAdd;
