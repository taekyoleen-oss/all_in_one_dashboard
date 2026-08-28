"use client";

/**
 * TasksBody — 작업 목록 + 하단 QuickAdd. 타일·전체보기가 크기 클래스만 달리해
 * 공유한다. 스크롤 목록 + 체크(완료 취소선) + 2단계 삭제 + 모바일 연동 표시.
 */

import * as React from "react";
import { Smartphone, Trash2 } from "lucide-react";
import { QuickAdd, quickBtnClass, quickInputClass } from "@/components/widgets/shared/QuickAdd";
import { taskDateLabel } from "./dateLabel";
import { useTasks } from "./useTasks";

export function TasksBody({
  instanceId,
  mobileSync,
  large,
}: {
  instanceId: string;
  mobileSync: boolean;
  large?: boolean;
}) {
  const { rows, add, toggle, remove } = useTasks(instanceId);
  const [draft, setDraft] = React.useState("");
  const [draftDate, setDraftDate] = React.useState("");
  const [confirmId, setConfirmId] = React.useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    add(draft, draftDate || null);
    setDraft(""); // 폼은 열어 두고 입력만 비움(연속 추가, QuickAdd 관례 — 일자는 유지)
  };

  const textCls = large ? "text-sm" : "text-xs";

  return (
    <div className="flex h-full min-h-0 flex-col">
      {mobileSync ? (
        <p className="mb-1 flex shrink-0 items-center gap-1 text-[10px] text-primary">
          <Smartphone size={11} aria-hidden /> 모바일 홈 화면에 표시 중
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
          아직 작업이 없습니다
        </p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto" data-pb-no-drag>
          {rows.map((t) => (
            <li
              key={t.id}
              className="group flex items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-accent/30"
            >
              <input
                type="checkbox"
                checked={t.done}
                onChange={(e) => toggle(t.id, e.target.checked)}
                aria-label={`${t.title} 완료`}
                className="size-4 shrink-0 accent-[var(--primary)]"
              />
              <span
                className={[
                  "min-w-0 flex-1 truncate",
                  textCls,
                  t.done ? "text-muted-foreground line-through" : "text-foreground",
                ].join(" ")}
              >
                {t.title}
              </span>
              {t.due_on ? (
                <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                  {taskDateLabel(t.due_on, new Date())}
                </span>
              ) : null}
              {confirmId === t.id ? (
                <button
                  type="button"
                  onClick={() => {
                    remove(t.id);
                    setConfirmId(null);
                  }}
                  className="shrink-0 rounded-md bg-destructive px-1.5 py-0.5 text-[10px] font-medium text-white outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  삭제?
                </button>
              ) : (
                <button
                  type="button"
                  aria-label={`${t.title} 삭제`}
                  onClick={() => setConfirmId(t.id)}
                  className="inline-flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 outline-none transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100 pointer-coarse:opacity-100 pointer-coarse:size-7"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <QuickAdd label="작업 추가">
        {() => (
          <form onSubmit={submit} className="flex flex-wrap items-center gap-1.5">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="할 작업 입력"
              className={`${quickInputClass} min-w-24 flex-1`}
              autoFocus
            />
            <input
              type="date"
              value={draftDate}
              onChange={(e) => setDraftDate(e.target.value)}
              aria-label="작업 일자 (선택)"
              className={`${quickInputClass} shrink-0`}
            />
            <button type="submit" disabled={!draft.trim()} className={quickBtnClass}>
              추가
            </button>
          </form>
        )}
      </QuickAdd>
    </div>
  );
}

export default TasksBody;
