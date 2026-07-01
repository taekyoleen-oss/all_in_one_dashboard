"use client";

/**
 * circle-schedule · ConfigEditor — 대상(구분) 관리.
 *
 *  구분(가족·친구·회사 등)을 추가·이름수정·색변경·삭제한다. 데이터는 Supabase
 *  (pb_circle_targets)에 직접 쓴다(card-usage의 CardManager와 동일 패턴) — config는
 *  뷰 필터만 담으므로 여기서 onChange는 사용하지 않는다.
 *
 *  대상의 email 컬럼은 향후 '대상별 공유'용으로 스키마에만 존재하며 여기서 노출하지
 *  않는다(설계 확장 대비).
 */

import * as React from "react";
import { Plus, Trash2, Users } from "lucide-react";
import type { ConfigEditorProps } from "@/lib/widgets/contract";
import { useCircleData } from "./useCircleData";
import { SEED_TARGETS, TARGET_COLORS, type CircleScheduleConfig } from "./types";

export function CircleScheduleConfigEditor(
  _props: ConfigEditorProps<CircleScheduleConfig>,
) {
  const data = useCircleData();
  const [name, setName] = React.useState("");
  const [color, setColor] = React.useState(TARGET_COLORS[0]);

  const add = async () => {
    const clean = name.trim();
    if (!clean) return;
    await data.addTarget(clean, color);
    setName("");
    // 다음 색을 순환 제안.
    const idx = TARGET_COLORS.indexOf(color);
    setColor(TARGET_COLORS[(idx + 1) % TARGET_COLORS.length]);
  };

  const seed = async () => {
    for (const t of SEED_TARGETS) await data.addTarget(t.name, t.color);
  };

  if (data.status === "signed-out") {
    return (
      <p className="px-1 py-3 text-sm text-muted-foreground">
        로그인 후 구분을 관리할 수 있습니다.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2 rounded-md border border-border p-3">
        <legend className="px-1 text-xs font-medium text-muted-foreground">
          구분(대상) 관리
        </legend>

        {data.targets.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border px-3 py-4 text-center">
            <Users size={18} className="text-muted-foreground" aria-hidden />
            <p className="text-xs text-muted-foreground">
              아직 구분이 없어요. 가족·친구 등으로 일정을 나눠 보세요.
            </p>
            <button
              type="button"
              onClick={() => void seed()}
              className="rounded-md border border-border px-2.5 py-1 text-xs text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              기본 구분(가족·친구) 추가
            </button>
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {data.targets.map((t) => (
              <TargetRow
                key={t.id}
                name={t.name}
                color={t.color ?? TARGET_COLORS[0]}
                onRename={(v) => void data.updateTarget(t.id, { name: v })}
                onRecolor={(v) => void data.updateTarget(t.id, { color: v })}
                onDelete={() => void data.removeTarget(t.id)}
              />
            ))}
          </ul>
        )}

        {/* 새 구분 추가 */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
          className="flex items-center gap-1.5"
        >
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            aria-label="구분 색상"
            className="h-8 w-8 shrink-0 cursor-pointer rounded-md border border-border bg-background p-0.5"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="새 구분 이름 (예: 회사)"
            className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="submit"
            disabled={!name.trim()}
            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-sm font-medium text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <Plus size={15} aria-hidden /> 추가
          </button>
        </form>

        {data.error ? (
          <p className="text-[11px] text-destructive">{data.error}</p>
        ) : null}
      </fieldset>

      <p className="text-[11px] leading-snug text-muted-foreground">
        구분을 삭제해도 그 구분의 약속은 사라지지 않고 ‘미지정’으로 남습니다. 약속의
        내용·대상은 타일/전체에서 바로 수정할 수 있어요.
      </p>
    </div>
  );
}

function TargetRow({
  name,
  color,
  onRename,
  onRecolor,
  onDelete,
}: {
  name: string;
  color: string;
  onRename: (v: string) => void;
  onRecolor: (v: string) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = React.useState(name);
  const [confirmDel, setConfirmDel] = React.useState(false);
  // 외부에서 name이 바뀌면(리네임 저장 후 refresh) 로컬 draft를 렌더 중 동기화.
  const [seenName, setSeenName] = React.useState(name);
  if (seenName !== name) {
    setSeenName(name);
    setDraft(name);
  }

  return (
    <li className="flex items-center gap-1.5 rounded-md border border-border bg-background/40 p-1.5">
      <input
        type="color"
        value={color}
        onChange={(e) => onRecolor(e.target.value)}
        aria-label={`${name} 색상`}
        className="h-7 w-7 shrink-0 cursor-pointer rounded-md border border-border bg-background p-0.5"
      />
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const v = draft.trim();
          if (v && v !== name) onRename(v);
          else setDraft(name);
        }}
        className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-foreground outline-none focus:border-border focus-visible:ring-2 focus-visible:ring-ring"
      />
      {confirmDel ? (
        <button
          type="button"
          onClick={onDelete}
          className="shrink-0 rounded-md border border-destructive px-1.5 py-1 text-[11px] text-destructive outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          삭제?
        </button>
      ) : (
        <button
          type="button"
          aria-label={`${name} 삭제`}
          onClick={() => {
            setConfirmDel(true);
            window.setTimeout(() => setConfirmDel(false), 2500);
          }}
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Trash2 size={14} aria-hidden />
        </button>
      )}
    </li>
  );
}

export default CircleScheduleConfigEditor;
