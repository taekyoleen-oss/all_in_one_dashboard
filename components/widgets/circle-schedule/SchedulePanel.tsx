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
  CalendarPlus,
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

/** 오늘(KST) 날짜 YYYY-MM-DD. 서버 TZ와 무관하게 Asia/Seoul 기준. */
function todayKstISODate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** "HH:MM"(24h) → "오전/오후 h시[m분]". */
function formatKoreanTime(time: string): string {
  const [hh, mm] = time.split(":").map(Number);
  if (Number.isNaN(hh)) return "";
  const ampm = hh < 12 ? "오전" : "오후";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${ampm} ${h12}시${mm ? `${mm}분` : ""}`;
}

/**
 * 직접 추가 폼의 날짜(YYYY-MM-DD)·시간(HH:MM)으로 정렬용 when_at(ISO)과 표시용
 * 접미사(M/D [시각])를 만든다. 시간만 있으면 오늘 날짜로 저장한다. 둘 다 없으면 null.
 */
function buildWhenAt(
  date: string,
  time: string,
): { whenAt: string | null; suffix: string } {
  if (!date && !time) return { whenAt: null, suffix: "" };
  const effDate = date || todayKstISODate();
  const [, m, d] = effDate.split("-").map(Number);
  const md = `${m}/${d}`;
  const whenAt = `${effDate}T${time || "00:00"}:00+09:00`;
  const suffix = time ? `${md} ${formatKoreanTime(time)}` : md;
  return { whenAt, suffix };
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
  const [mode, setMode] = React.useState<"list" | "compose" | "manual">("list");

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
  if (mode === "manual") {
    return <ManualAdd data={data} onDone={() => setMode("list")} />;
  }

  return (
    <ListMode
      data={data}
      size={size}
      filter={filter}
      setFilter={setFilter}
      onCompose={() => setMode("compose")}
      onManual={() => setMode("manual")}
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
  onManual,
}: {
  data: CircleData;
  size: Size;
  filter: string;
  setFilter: (f: string) => void;
  onCompose: () => void;
  onManual: () => void;
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

      {/* 추가: 직접 추가 + 카카오톡 정리 — 얇은 한 줄(타일 하단 공백 최소화 요구). */}
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onManual}
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CalendarPlus size={12} aria-hidden /> 직접 추가
        </button>
        <button
          type="button"
          onClick={onCompose}
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-border px-2 py-0.5 text-[11px] font-medium text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Sparkles size={12} aria-hidden /> 카카오톡 정리
        </button>
      </div>
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
  const [addingTarget, setAddingTarget] = React.useState(false);
  // 이 대화의 '대상자(구분)'. 추출 후보의 기본 대상으로 적용된다("" = 미지정).
  const [selectedTarget, setSelectedTarget] = React.useState("");

  // 추출 결과 → 검토용 초안. result가 새로 오면 렌더 중 초안을 파생(효과 없이 동기화).
  // 각 후보의 대상은 위에서 고른 '대화 상대'로 기본 지정한다.
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
            targetId: selectedTarget,
            excluded: false,
          }))
        : [],
    );
  }

  // '대화 상대' 변경 시 모든 후보에 일괄 적용(카카오톡은 보통 한 사람과의 대화).
  const applyTargetToAll = (id: string) => {
    setSelectedTarget(id);
    setDrafts((prev) => prev.map((d) => ({ ...d, targetId: id })));
  };

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
    setAddingTarget(false);
    // 만든 대상자를 선택하고 모든 후보에 일괄 적용.
    if (created) applyTargetToAll(created.id);
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
      {/* 상단: 대상자 선택 + 새 대상자 추가(＋) + 닫기(✕) — 한 줄로 컴팩트 */}
      <div className="flex shrink-0 flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <select
            value={selectedTarget}
            onChange={(e) => applyTargetToAll(e.target.value)}
            aria-label="대상자(구분)"
            className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">대상자 선택(미지정)</option>
            {data.targets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            aria-label="새 대상자 추가"
            title="새 대상자 추가"
            onClick={() => setAddingTarget((v) => !v)}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus size={15} aria-hidden />
          </button>
          <button
            type="button"
            aria-label="닫기"
            title="닫기"
            onClick={onDone}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X size={15} aria-hidden />
          </button>
        </div>
        {addingTarget ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void addTargetInline();
            }}
            className="flex items-center gap-1.5"
          >
            <input
              autoFocus
              value={newTarget}
              onChange={(e) => setNewTarget(e.target.value)}
              placeholder="새 대상자 이름(예: 소연)"
              className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              type="submit"
              disabled={!newTarget.trim()}
              className="shrink-0 rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
            >
              추가
            </button>
          </form>
        ) : null}
      </div>

      {!showReview ? (
        <>
          {/* 입력 */}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="약속 관련 카톡 내용 붙여넣기"
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
              <p className="text-sm">약속을 찾지 못했어요.</p>
            </div>
          ) : (
            <>
              <p className="shrink-0 text-[11px] text-muted-foreground">
                {drafts.filter((d) => !d.excluded).length}건 · 확인 후 저장
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

/* ------------------------------- manual add ------------------------------ */

function ManualAdd({
  data,
  onDone,
}: {
  data: CircleData;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [content, setContent] = React.useState("");
  const [targetId, setTargetId] = React.useState("");
  const [date, setDate] = React.useState("");
  const [time, setTime] = React.useState("");
  const [newTarget, setNewTarget] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const addTargetInline = async () => {
    const name = newTarget.trim();
    if (!name) return;
    const color = TARGET_COLORS[data.targets.length % TARGET_COLORS.length];
    const created = await data.addTarget(name, color);
    setNewTarget("");
    if (created) setTargetId(created.id); // 방금 만든 구분을 바로 선택.
  };

  const handleSave = async () => {
    const core = content.trim();
    if (!core) return;
    const { whenAt, suffix } = buildWhenAt(date, time);
    const finalContent = suffix ? `${core} (${suffix})` : core;
    setSaving(true);
    await data.saveAppointments([
      {
        content: finalContent,
        when_at: whenAt,
        source: null,
        target_id: targetId || null,
      },
    ]);
    setSaving(false);
    toast({ title: "일정을 추가했어요.", variant: "success" });
    onDone();
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void handleSave();
      }}
      className="flex h-full flex-col gap-2"
    >
      {/* 헤더 */}
      <div className="flex shrink-0 items-center justify-between gap-2">
        <span className="text-xs font-medium text-foreground">일정 직접 추가</span>
        <button
          type="button"
          onClick={onDone}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X size={13} aria-hidden /> 닫기
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pb-scroll">
        {/* 내용 */}
        <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
          내용
          <input
            autoFocus
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="예: 엄마와 병원, 저녁 약속"
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>

        {/* 구분 */}
        <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
          구분 (선택)
          <TargetSelect value={targetId} targets={data.targets} onChange={setTargetId} />
        </label>

        {/* 새 구분 빠른 추가 */}
        <div className="flex items-center gap-1.5">
          <input
            value={newTarget}
            onChange={(e) => setNewTarget(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void addTargetInline();
              }
            }}
            placeholder="새 구분(예: 소연)"
            className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="button"
            disabled={!newTarget.trim()}
            onClick={() => void addTargetInline()}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
          >
            <Plus size={12} aria-hidden /> 구분
          </button>
        </div>

        {/* 날짜 · 시간 */}
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
            날짜 (선택)
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
            시간 (선택)
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
        </div>
        <p className="text-[11px] text-muted-foreground">
          날짜·시간은 선택이에요. 시간만 입력하면 오늘 날짜로 저장되고, 내용 뒤에
          <span className="text-foreground"> (7/1 오후 5시)</span> 형태로 붙습니다.
        </p>
      </div>

      {/* 액션 */}
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onDone}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={saving || !content.trim()}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-2 py-1.5 text-sm font-medium text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" aria-hidden /> : null}
          저장
        </button>
      </div>
    </form>
  );
}

export default SchedulePanel;
