"use client";

/**
 * TasksBody — 작업 목록 + 하단 QuickAdd. 타일·전체보기가 크기 클래스만 달리해 공유.
 *
 *  모바일 홈 화면 위젯과 같은 조작을 웹에서도 제공한다(요구):
 *   • 상단 필터 콤보(진행중 기본 · 완료 · 전체)
 *   • 왼쪽은 조작 불가 **진행/완료 표시 라벨**(체크박스 아님)
 *   • 행 클릭 = 인라인 수정(제목·일자·진행/완료) + 저장/취소/삭제
 *   • 완료는 흐림+취소선, 일자는 본문 크기 + 요일 병기
 *  완료 '유예'(다음 갱신까지 진행중에 남김)는 모바일 위젯의 폴링 특성을 위한
 *  장치라 웹(realtime 즉시 반영)에는 두지 않는다 — 웹은 즉시 필터에 반영된다.
 */

import * as React from "react";
import { Check, Smartphone, Trash2, X } from "lucide-react";
import { QuickAdd, quickBtnClass, quickInputClass } from "@/components/widgets/shared/QuickAdd";
import type { TaskRow } from "@/output/api-shapes";
import { taskDateLabel } from "./dateLabel";
import { useTasks } from "./useTasks";

type Filter = "pending" | "done" | "all";

const FILTER_LABEL: Record<Filter, string> = {
  pending: "진행중",
  done: "완료",
  all: "전체",
};

export function TasksBody({
  instanceId,
  mobileSync,
  large,
}: {
  instanceId: string;
  mobileSync: boolean;
  large?: boolean;
}) {
  const { rows, add, update, remove } = useTasks(instanceId);
  const [draft, setDraft] = React.useState("");
  const [draftDate, setDraftDate] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("pending");
  const [editId, setEditId] = React.useState<string | null>(null);
  // ✕ 1탭 = '삭제' 표시(예정), 재탭 = 취소 — 모바일 위젯과 같은 방식(요구).
  // 웹은 realtime이라 '다음 갱신' 개념이 없으므로 상단의 '삭제 실행'으로 확정한다.
  const [pendingDelete, setPendingDelete] = React.useState<Set<string>>(new Set());

  const toggleDeleteMark = (id: string) =>
    setPendingDelete((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    add(draft, draftDate || null);
    setDraft(""); // 폼은 열어 두고 입력만 비움(연속 추가, QuickAdd 관례 — 일자는 유지)
  };

  const visible = rows.filter((t) =>
    filter === "all" ? true : filter === "done" ? t.done : !t.done,
  );
  const textCls = large ? "text-sm" : "text-xs";

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* 필터: 모바일 위젯과 같은 3버튼 나열(기본 진행). */}
      <div className="mb-1 flex shrink-0 items-center gap-1" role="group" aria-label="작업 상태 필터">
        {(Object.keys(FILTER_LABEL) as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={[
              "rounded-md px-1.5 py-0.5 text-[11px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              filter === f
                ? "bg-primary/10 font-bold text-primary"
                : "text-muted-foreground hover:bg-accent/40",
            ].join(" ")}
          >
            {FILTER_LABEL[f]}
          </button>
        ))}
        <span className="ml-1 text-[10px] text-muted-foreground">
          남은 {rows.filter((t) => !t.done).length}개
        </span>
        {pendingDelete.size > 0 ? (
          <button
            type="button"
            onClick={() => {
              pendingDelete.forEach((id) => remove(id));
              setPendingDelete(new Set());
            }}
            className="ml-auto rounded-md bg-destructive px-2 py-0.5 text-[10px] font-medium text-white outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
          >
            {pendingDelete.size}개 삭제 실행
          </button>
        ) : mobileSync ? (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-primary">
            <Smartphone size={11} aria-hidden /> 모바일 표시 중
          </span>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <p className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
          {filter === "done" ? "완료한 작업이 없습니다" : "아직 작업이 없습니다"}
        </p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto" data-pb-no-drag>
          {visible.map((t) =>
            editId === t.id ? (
              <li key={t.id} className="rounded-md border border-border p-1.5">
                <TaskEditRow
                  task={t}
                  onCancel={() => setEditId(null)}
                  onSave={(patch) => {
                    update(t.id, patch);
                    setEditId(null);
                  }}
                  onDelete={() => {
                    remove(t.id);
                    setEditId(null);
                  }}
                />
              </li>
            ) : (
              <li key={t.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setEditId(t.id)}
                  title="클릭해서 수정"
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left outline-none transition-colors hover:bg-accent/30 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span
                    className={[
                      "shrink-0 text-[10px] font-bold",
                      t.done ? "text-muted-foreground" : "text-primary",
                    ].join(" ")}
                  >
                    {t.done ? "완료" : "진행"}
                  </span>
                  <span
                    className={[
                      "min-w-0 flex-1 truncate",
                      textCls,
                      t.done || pendingDelete.has(t.id)
                        ? "text-muted-foreground"
                        : "text-foreground",
                      t.done ? "line-through" : "",
                    ].join(" ")}
                  >
                    {t.title}
                  </span>
                  {t.due_on ? (
                    <span className={`shrink-0 tabular-nums text-muted-foreground ${textCls}`}>
                      {taskDateLabel(t.due_on, new Date())}
                    </span>
                  ) : null}
                  {pendingDelete.has(t.id) ? (
                    <span className="shrink-0 text-[10px] font-bold text-destructive">삭제</span>
                  ) : null}
                </button>
                <button
                  type="button"
                  aria-label={`${t.title} 삭제 표시`}
                  title={pendingDelete.has(t.id) ? "삭제 표시 취소" : "삭제 예정으로 표시"}
                  onClick={() => toggleDeleteMark(t.id)}
                  className={[
                    "inline-flex size-6 shrink-0 items-center justify-center rounded-md outline-none transition-colors hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:size-8",
                    pendingDelete.has(t.id) ? "text-destructive" : "text-muted-foreground",
                  ].join(" ")}
                >
                  <X size={13} />
                </button>
              </li>
            ),
          )}
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

/** 인라인 수정 폼 — 모바일 TaskEditActivity와 같은 필드 구성. */
function TaskEditRow({
  task,
  onSave,
  onCancel,
  onDelete,
}: {
  task: TaskRow;
  onSave: (patch: { title: string; done: boolean; dueOn: string | null }) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = React.useState(task.title);
  const [dueOn, setDueOn] = React.useState(task.due_on ?? "");
  const [done, setDone] = React.useState(task.done);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        aria-label="작업 내용"
        className={quickInputClass}
        autoFocus
      />
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          type="date"
          value={dueOn}
          onChange={(e) => setDueOn(e.target.value)}
          aria-label="작업 일자 (선택)"
          className={`${quickInputClass} shrink-0`}
        />
        <select
          value={done ? "done" : "pending"}
          onChange={(e) => setDone(e.target.value === "done")}
          aria-label="진행 상태"
          className={`${quickInputClass} shrink-0`}
        >
          <option value="pending">진행</option>
          <option value="done">완료</option>
        </select>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onSave({ title, done, dueOn: dueOn || null })}
          disabled={!title.trim()}
          className={quickBtnClass}
        >
          <Check size={12} aria-hidden /> 저장
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[11px] text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X size={12} aria-hidden /> 취소
        </button>
        {confirmDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className="ml-auto rounded-md bg-destructive px-2 py-0.5 text-[11px] font-medium text-white outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
          >
            삭제?
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            aria-label="이 작업 삭제"
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[11px] text-destructive outline-none transition-colors hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Trash2 size={12} aria-hidden /> 삭제
          </button>
        )}
      </div>
    </div>
  );
}

export default TasksBody;
