"use client";

/**
 * SchedulePanel — 지인 일정 정리 위젯의 공용 본문(타일·전체 공통).
 *
 *  두 모드:
 *   • 목록: 대상(구분)별 필터 칩 + 약속 목록(인라인 수정/삭제) + 하단 "카카오톡 정리" 버튼.
 *   • 정리(compose): 카카오톡 텍스트 붙여넣기 → [정리하기](서버 LLM) → 후보 검토
 *     (문장 편집·대상 선택·개별 제외) → [저장].
 *
 *  데이터는 useCircleData(Supabase/RLS), 추출은 useExtract(/api). 선택된 필터는
 *  config(pb_widgets)에 저장돼 타일↔전체가 공유하고 리로드에도 유지된다.
 */

import * as React from "react";
import {
  ClipboardPaste,
  Loader2,
  MessageSquarePlus,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useSaveWidgetConfig } from "@/lib/widgets/persistence";
import { useToast } from "@/components/ui/Toaster";
import type { CircleAppointment, CircleTarget } from "@/output/api-shapes";
import { useCircleData, type AppointmentDraft, type CircleData } from "./useCircleData";
import { useExtract } from "./useExtract";
import {
  FILTER_ALL,
  FILTER_UNASSIGNED,
  TARGET_COLORS,
  type CircleScheduleConfig,
} from "./types";

type Size = "compact" | "expanded";

/* --------------------------------- helpers -------------------------------- */

function targetColor(t?: CircleTarget | null): string | null {
  return (t?.color ?? null) || null;
}

/** 대상 배지(색상 있으면 색, 없으면 회색). */
function TargetBadge({ target }: { target?: CircleTarget | null }) {
  const label = target?.name ?? "미지정";
  const color = targetColor(target);
  const style = color
    ? { color, borderColor: color, backgroundColor: `${color}1A` }
    : undefined;
  return (
    <span
      className={[
        "inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
        color ? "" : "border-border bg-muted text-muted-foreground",
      ].join(" ")}
      style={style}
    >
      {label}
    </span>
  );
}

/* ------------------------------- main panel ------------------------------- */

export function SchedulePanel({
  config,
  instanceId,
  size,
}: {
  config: CircleScheduleConfig;
  instanceId: string;
  size: Size;
}) {
  const data = useCircleData();
  const save = useSaveWidgetConfig();
  const [mode, setMode] = React.useState<"list" | "compose">("list");

  if (data.status === "loading") {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2 size={18} className="animate-spin" aria-hidden />
      </div>
    );
  }
  if (data.status === "signed-out") {
    return (
      <p className="flex h-full items-center justify-center px-3 text-center text-sm text-muted-foreground">
        로그인하면 지인 일정을 저장·정리할 수 있어요.
      </p>
    );
  }

  const filter = config.filter ?? FILTER_ALL;
  const setFilter = (f: string) => save(instanceId, { ...config, filter: f });

  if (mode === "compose") {
    return <Composer data={data} size={size} onDone={() => setMode("list")} />;
  }

  return (
    <ListMode
      data={data}
      size={size}
      filter={filter}
      setFilter={setFilter}
      onCompose={() => setMode("compose")}
    />
  );
}

/* -------------------------------- list mode ------------------------------- */

function ListMode({
  data,
  size,
  filter,
  setFilter,
  onCompose,
}: {
  data: CircleData;
  size: Size;
  filter: string;
  setFilter: (f: string) => void;
  onCompose: () => void;
}) {
  const byId = React.useMemo(() => {
    const m = new Map<string, CircleTarget>();
    for (const t of data.targets) m.set(t.id, t);
    return m;
  }, [data.targets]);

  const counts = React.useMemo(() => {
    const c = new Map<string, number>();
    let unassigned = 0;
    for (const a of data.appointments) {
      if (a.target_id) c.set(a.target_id, (c.get(a.target_id) ?? 0) + 1);
      else unassigned += 1;
    }
    return { c, unassigned };
  }, [data.appointments]);

  const filtered = React.useMemo(() => {
    if (filter === FILTER_ALL) return data.appointments;
    if (filter === FILTER_UNASSIGNED)
      return data.appointments.filter((a) => !a.target_id);
    return data.appointments.filter((a) => a.target_id === filter);
  }, [data.appointments, filter]);

  const chip = (key: string, label: string, count: number, color?: string | null) => {
    const active = filter === key;
    const style =
      active && color
        ? { backgroundColor: `${color}1A`, borderColor: color, color }
        : undefined;
    return (
      <button
        key={key}
        type="button"
        aria-pressed={active}
        onClick={() => setFilter(key)}
        style={style}
        className={[
          "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
          active
            ? color
              ? ""
              : "border-primary bg-primary/10 text-foreground"
            : "border-border text-muted-foreground hover:bg-accent/40",
        ].join(" ")}
      >
        <span className="truncate">{label}</span>
        <span className="tabular-nums opacity-70">{count}</span>
      </button>
    );
  };

  return (
    <div className="flex h-full flex-col gap-1.5">
      {/* 대상(구분) 필터 */}
      <div
        role="group"
        aria-label="대상 필터"
        className="flex shrink-0 items-center gap-1 overflow-x-auto pb-scroll"
      >
        {chip(FILTER_ALL, "전체", data.appointments.length)}
        {data.targets.map((t) =>
          chip(t.id, t.name, counts.c.get(t.id) ?? 0, t.color),
        )}
        {counts.unassigned > 0
          ? chip(FILTER_UNASSIGNED, "미지정", counts.unassigned)
          : null}
      </div>

      {/* 약속 목록 */}
      {filtered.length === 0 ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 px-3 text-center text-muted-foreground">
          <MessageSquarePlus size={20} aria-hidden />
          <p className="text-xs">
            {data.appointments.length === 0
              ? "카카오톡 내용을 붙여넣어 일정을 정리해 보세요."
              : "이 구분에는 일정이 없어요."}
          </p>
        </div>
      ) : (
        <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pb-scroll">
          {filtered.map((a) => (
            <AppointmentRow
              key={a.id}
              appt={a}
              target={a.target_id ? byId.get(a.target_id) ?? null : null}
              targets={data.targets}
              size={size}
              onUpdate={(patch) => void data.updateAppointment(a.id, patch)}
              onDelete={() => void data.removeAppointment(a.id)}
            />
          ))}
        </ul>
      )}

      {data.error ? (
        <p className="shrink-0 text-[11px] text-destructive">{data.error}</p>
      ) : null}

      {/* 카카오톡 정리 시작 */}
      <button
        type="button"
        onClick={onCompose}
        className="flex w-full shrink-0 items-center justify-center gap-1.5 rounded-md bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Sparkles size={14} aria-hidden /> 카카오톡 정리하기
      </button>
    </div>
  );
}

/* ------------------------------ appointment row --------------------------- */

function AppointmentRow({
  appt,
  target,
  targets,
  size,
  onUpdate,
  onDelete,
}: {
  appt: CircleAppointment;
  target: CircleTarget | null;
  targets: CircleTarget[];
  size: Size;
  onUpdate: (patch: { content?: string; target_id?: string | null }) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [content, setContent] = React.useState(appt.content);
  const [targetId, setTargetId] = React.useState<string>(appt.target_id ?? "");
  const [confirmDel, setConfirmDel] = React.useState(false);

  if (editing) {
    return (
      <li className="rounded-md border border-primary/40 bg-primary/5 p-1.5">
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="mb-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <div className="flex items-center gap-1.5">
          <TargetSelect
            value={targetId}
            targets={targets}
            onChange={setTargetId}
          />
          <button
            type="button"
            onClick={() => {
              onUpdate({
                content,
                target_id: targetId || null,
              });
              setEditing(false);
            }}
            className="shrink-0 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
          >
            저장
          </button>
          <button
            type="button"
            aria-label="취소"
            onClick={() => {
              setContent(appt.content);
              setTargetId(appt.target_id ?? "");
              setEditing(false);
            }}
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X size={14} />
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2 rounded-md border border-border bg-background/40 px-2 py-1.5">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={[
            "break-words text-foreground",
            size === "expanded" ? "text-sm" : "text-[13px]",
          ].join(" ")}
        >
          {appt.content}
        </span>
        <TargetBadge target={target} />
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          aria-label="수정"
          title="수정"
          onClick={() => setEditing(true)}
          className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Pencil size={13} aria-hidden />
        </button>
        {confirmDel ? (
          <button
            type="button"
            onClick={onDelete}
            className="rounded-md border border-destructive px-1.5 py-0.5 text-[11px] text-destructive outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            삭제?
          </button>
        ) : (
          <button
            type="button"
            aria-label="삭제"
            title="삭제"
            onClick={() => {
              setConfirmDel(true);
              window.setTimeout(() => setConfirmDel(false), 2500);
            }}
            className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Trash2 size={13} aria-hidden />
          </button>
        )}
      </div>
    </li>
  );
}

/* ------------------------------- target select ---------------------------- */

function TargetSelect({
  value,
  targets,
  onChange,
}: {
  value: string;
  targets: CircleTarget[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <option value="">미지정</option>
      {targets.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </select>
  );
}

/* --------------------------------- composer ------------------------------- */

interface Draft {
  key: string;
  content: string;
  when_at: string | null;
  source?: string | null;
  targetId: string; // "" = 미지정
  excluded: boolean;
}

function Composer({
  data,
  size,
  onDone,
}: {
  data: CircleData;
  size: Size;
  onDone: () => void;
}) {
  const { result, loading, error, run, clear } = useExtract();
  const { toast } = useToast();
  const [text, setText] = React.useState("");
  const [drafts, setDrafts] = React.useState<Draft[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [newTarget, setNewTarget] = React.useState("");

  // 추출 결과 → 검토용 초안(모두 포함, 대상 미지정으로 시작). result가 새로 오면
  // 렌더 중 초안을 파생(효과 없이 동기화 — 새 결과 도착 시 1회만 반영).
  const [seenResult, setSeenResult] = React.useState(result);
  if (result !== seenResult) {
    setSeenResult(result);
    setDrafts(
      result
        ? result.map((r, i) => ({
            key: `cand-${i}`,
            content: r.content,
            when_at: r.when_at,
            source: r.source ?? null,
            targetId: "",
            excluded: false,
          }))
        : [],
    );
  }

  const pasteFromClipboard = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) setText((prev) => (prev ? `${prev}\n${t}` : t));
    } catch {
      /* 권한 거부 등 — 조용히 무시(사용자가 직접 붙여넣기 가능) */
    }
  };

  const addTargetInline = async () => {
    const name = newTarget.trim();
    if (!name) return;
    const color = TARGET_COLORS[data.targets.length % TARGET_COLORS.length];
    const created = await data.addTarget(name, color);
    setNewTarget("");
    if (created) {
      // 새 구분을 미지정 초안들에 자동 배정(편의).
      setDrafts((prev) =>
        prev.map((d) => (d.targetId ? d : { ...d, targetId: created.id })),
      );
    }
  };

  const handleSave = async () => {
    const items: AppointmentDraft[] = drafts
      .filter((d) => !d.excluded && d.content.trim())
      .map((d) => ({
        content: d.content,
        when_at: d.when_at,
        source: d.source,
        target_id: d.targetId || null,
      }));
    if (items.length === 0) {
      onDone();
      return;
    }
    setSaving(true);
    const n = await data.saveAppointments(items);
    setSaving(false);
    toast({
      title: `${n}건의 일정을 저장했어요.`,
      variant: "success",
    });
    onDone();
  };

  const showReview = result !== null && !loading;

  return (
    <div className="flex h-full flex-col gap-2">
      {/* 헤더 */}
      <div className="flex shrink-0 items-center justify-between gap-2">
        <span className="text-xs font-medium text-foreground">
          카카오톡 일정 정리
        </span>
        <button
          type="button"
          onClick={onDone}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X size={13} aria-hidden /> 닫기
        </button>
      </div>

      {!showReview ? (
        <>
          {/* 입력 */}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="카카오톡 대화에서 약속 관련 내용을 복사해 붙여넣으세요."
            spellCheck={false}
            data-pb-no-drag=""
            className={[
              "min-h-0 flex-1 resize-none rounded-md border border-border bg-background p-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring [scrollbar-width:thin]",
              size === "expanded" ? "min-h-[30dvh]" : "",
            ].join(" ")}
          />
          {error ? (
            <p className="shrink-0 text-[11px] text-destructive">{error}</p>
          ) : null}
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => void pasteFromClipboard()}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ClipboardPaste size={14} aria-hidden /> 붙여넣기
            </button>
            <button
              type="button"
              disabled={loading || !text.trim()}
              onClick={() => run(text)}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-2 py-1.5 text-sm font-medium text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              {loading ? (
                <Loader2 size={14} className="animate-spin" aria-hidden />
              ) : (
                <Sparkles size={14} aria-hidden />
              )}
              {loading ? "정리 중…" : "정리하기"}
            </button>
          </div>
        </>
      ) : (
        <>
          {/* 검토 */}
          {drafts.length === 0 ? (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 text-center text-muted-foreground">
              <p className="text-sm">추출된 약속이 없습니다.</p>
              <p className="text-xs">다른 대화 내용으로 다시 시도해 보세요.</p>
            </div>
          ) : (
            <>
              <p className="shrink-0 text-[11px] text-muted-foreground">
                {drafts.filter((d) => !d.excluded).length}건 선택됨 · 문장·대상을
                확인하고 저장하세요.
              </p>
              <ul className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pb-scroll">
                {drafts.map((d, i) => (
                  <li
                    key={d.key}
                    className={[
                      "rounded-md border p-1.5",
                      d.excluded
                        ? "border-border bg-muted/40 opacity-60"
                        : "border-primary/40 bg-primary/5",
                    ].join(" ")}
                  >
                    <input
                      value={d.content}
                      onChange={(e) =>
                        setDrafts((prev) =>
                          prev.map((x, j) =>
                            j === i ? { ...x, content: e.target.value } : x,
                          ),
                        )
                      }
                      disabled={d.excluded}
                      className="mb-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                    />
                    <div className="flex items-center gap-1.5">
                      <TargetSelect
                        value={d.targetId}
                        targets={data.targets}
                        onChange={(v) =>
                          setDrafts((prev) =>
                            prev.map((x, j) =>
                              j === i ? { ...x, targetId: v } : x,
                            ),
                          )
                        }
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setDrafts((prev) =>
                            prev.map((x, j) =>
                              j === i ? { ...x, excluded: !x.excluded } : x,
                            ),
                          )
                        }
                        className={[
                          "shrink-0 rounded-md border px-2 py-1 text-[11px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                          d.excluded
                            ? "border-primary text-primary hover:bg-primary/10"
                            : "border-border text-muted-foreground hover:bg-accent",
                        ].join(" ")}
                      >
                        {d.excluded ? "포함" : "제외"}
                      </button>
                    </div>
                    {size === "expanded" && d.source ? (
                      <p className="mt-1 truncate text-[10px] text-muted-foreground">
                        근거: {d.source}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>

              {/* 새 구분 빠른 추가 */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void addTargetInline();
                }}
                className="flex shrink-0 items-center gap-1.5"
              >
                <input
                  value={newTarget}
                  onChange={(e) => setNewTarget(e.target.value)}
                  placeholder="새 구분(예: 회사)"
                  className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <button
                  type="submit"
                  disabled={!newTarget.trim()}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
                >
                  <Plus size={12} aria-hidden /> 구분
                </button>
              </form>
            </>
          )}

          {/* 액션 */}
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                clear();
                setDrafts([]);
              }}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              다시
            </button>
            <button
              type="button"
              disabled={saving || drafts.every((d) => d.excluded)}
              onClick={() => void handleSave()}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-2 py-1.5 text-sm font-medium text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" aria-hidden />
              ) : null}
              저장
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default SchedulePanel;
