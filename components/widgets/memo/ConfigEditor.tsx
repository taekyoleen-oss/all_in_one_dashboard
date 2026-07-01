"use client";

/**
 * memo · ConfigEditor — body text + accent color + size (설계서 §2.1 #2).
 *
 *  Reports every change up via onChange; the parent (ConfigDialog) owns the draft
 *  + persistence. Pure controlled inputs — no local mirror of config.
 */

import * as React from "react";
import { Lock } from "lucide-react";
import type { ConfigEditorProps } from "@/lib/widgets/contract";
import {
  MEMO_COLORS,
  MEMO_TEXT_COLORS,
  hashPassword,
  type MemoColor,
  type MemoConfig,
  type MemoSize,
} from "./types";

const SIZE_ORDER: MemoSize[] = ["sm", "md", "lg"];
const SIZE_LABEL: Record<MemoSize, string> = { sm: "작게", md: "보통", lg: "크게" };
const COLOR_ORDER = Object.keys(MEMO_COLORS) as MemoColor[];
const LOCK_TIMEOUTS = [1, 5, 15, 30, 60];

export function MemoConfigEditor({ config, onChange }: ConfigEditorProps<MemoConfig>) {
  const locked = !!config.pwHash;
  return (
    <div className="flex flex-col gap-4">
      {/* 잠긴 메모는 내용을 편집기에 노출하지 않는다(잠금 우회 방지) → 타일에서 해제 후 편집. */}
      {locked ? (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <Lock size={14} aria-hidden className="shrink-0" />
          <span>
            비밀번호로 잠긴 메모입니다. 내용은 타일에서 잠금 해제 후 편집하세요.
          </span>
        </div>
      ) : (
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground">메모 내용</span>
          <textarea
            value={config.text}
            onChange={(e) => onChange({ ...config, text: e.target.value })}
            spellCheck={false}
            rows={6}
            placeholder="메모를 입력하세요…"
            className="min-h-32 resize-y rounded-md border border-border bg-background p-2 text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
      )}

      <MemoPasswordSection config={config} onChange={onChange} />

      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-1 text-muted-foreground">강조 색상</legend>
        <div className="flex flex-wrap gap-2">
          {COLOR_ORDER.map((c) => {
            const selected = config.color === c;
            return (
              <button
                key={c}
                type="button"
                aria-pressed={selected}
                onClick={() => onChange({ ...config, color: c })}
                title={MEMO_COLORS[c].label}
                className={[
                  "flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  selected
                    ? "border-ring bg-accent text-accent-foreground"
                    : "border-border text-muted-foreground hover:bg-accent/60",
                ].join(" ")}
              >
                <span
                  aria-hidden
                  className="size-3 rounded-full border border-black/10"
                  style={{ backgroundColor: MEMO_COLORS[c].swatch }}
                />
                {/* Label text ⇒ color is never the only signal. */}
                {MEMO_COLORS[c].label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-1 text-muted-foreground">글자 색</legend>
        <div className="flex flex-wrap items-center gap-2">
          {/* 자동(테마): textColor 없음 → 라이트=검정 · 다크=흰색 */}
          <button
            type="button"
            aria-pressed={!config.textColor}
            onClick={() => {
              const next = { ...config };
              delete next.textColor;
              onChange(next);
            }}
            title="테마 자동 (라이트=검정 · 다크=흰색)"
            className={[
              "flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              !config.textColor
                ? "border-ring bg-accent text-accent-foreground"
                : "border-border text-muted-foreground hover:bg-accent/60",
            ].join(" ")}
          >
            <span
              aria-hidden
              className="size-3 rounded-full border border-border bg-foreground"
            />
            기본
          </button>

          {MEMO_TEXT_COLORS.map((c) => {
            const selected = config.textColor === c;
            return (
              <button
                key={c}
                type="button"
                aria-pressed={selected}
                aria-label={c}
                title={c}
                onClick={() => onChange({ ...config, textColor: c })}
                className={[
                  "size-7 rounded-md border outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring",
                  selected ? "border-ring ring-2 ring-ring" : "border-border hover:scale-110",
                ].join(" ")}
                style={{ backgroundColor: c }}
              />
            );
          })}

          {/* 임의 색 직접 선택 */}
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            직접
            <input
              type="color"
              value={config.textColor ?? "#ef4444"}
              onChange={(e) => onChange({ ...config, textColor: e.target.value })}
              aria-label="직접 글자 색 선택"
              className="h-7 w-9 cursor-pointer rounded border border-border bg-transparent p-0.5"
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-1 text-muted-foreground">글자 크기</legend>
        <div
          role="group"
          aria-label="글자 크기"
          className="inline-flex w-fit overflow-hidden rounded-md border border-border"
        >
          {SIZE_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={config.size === s}
              onClick={() => onChange({ ...config, size: s })}
              className={[
                "px-3 py-1.5 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                config.size === s
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/60",
              ].join(" ")}
            >
              {SIZE_LABEL[s]}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

/* ------------------------- 비밀번호(화면 잠금) 섹션 ------------------------- */

function MemoPasswordSection({
  config,
  onChange,
}: {
  config: MemoConfig;
  onChange: (next: MemoConfig) => void;
}) {
  const has = !!config.pwHash;
  const [cur, setCur] = React.useState("");
  const [np, setNp] = React.useState("");
  const [np2, setNp2] = React.useState("");
  const [msg, setMsg] = React.useState<string | null>(null);
  const lockMin = config.lockAfterMin || 5;

  const setPassword = async () => {
    if (np.trim().length < 4) return setMsg("비밀번호는 4자 이상이어야 합니다.");
    if (np !== np2) return setMsg("비밀번호 확인이 일치하지 않습니다.");
    const h = await hashPassword(np);
    onChange({ ...config, pwHash: h, lockAfterMin: config.lockAfterMin ?? 5 });
    setNp("");
    setNp2("");
    setMsg("잠금이 설정되었습니다.");
  };

  const changePassword = async () => {
    const ch = await hashPassword(cur);
    if (!ch || ch !== config.pwHash) return setMsg("현재 비밀번호가 올바르지 않습니다.");
    if (np.trim().length < 4) return setMsg("새 비밀번호는 4자 이상이어야 합니다.");
    if (np !== np2) return setMsg("새 비밀번호 확인이 일치하지 않습니다.");
    const h = await hashPassword(np);
    onChange({ ...config, pwHash: h });
    setCur("");
    setNp("");
    setNp2("");
    setMsg("비밀번호가 변경되었습니다.");
  };

  const removePassword = async () => {
    const ch = await hashPassword(cur);
    if (!ch || ch !== config.pwHash) return setMsg("현재 비밀번호가 올바르지 않습니다.");
    const next: MemoConfig = { ...config };
    next.pwHash = null;
    onChange(next);
    setCur("");
    setMsg(null);
  };

  const inputCls =
    "w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <fieldset className="flex flex-col gap-2 rounded-md border border-border p-3 text-sm">
      <legend className="px-1 text-xs font-medium text-muted-foreground">
        비밀번호 잠금 (선택)
      </legend>

      {!has ? (
        <div className="flex flex-col gap-1.5">
          <input
            type="password"
            value={np}
            onChange={(e) => {
              setNp(e.target.value);
              setMsg(null);
            }}
            autoComplete="new-password"
            placeholder="비밀번호 (4자 이상)"
            className={inputCls}
          />
          <input
            type="password"
            value={np2}
            onChange={(e) => {
              setNp2(e.target.value);
              setMsg(null);
            }}
            autoComplete="new-password"
            placeholder="비밀번호 확인"
            className={inputCls}
          />
          <button
            type="button"
            onClick={() => void setPassword()}
            className="self-start rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
          >
            잠금 설정
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-1.5 text-xs text-foreground">
            <Lock size={13} aria-hidden className="text-muted-foreground" />
            비밀번호가 설정되어 있습니다.
          </p>

          {/* 자동 잠금 시간 */}
          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">자동 잠금 시간</span>
            <div className="flex flex-wrap gap-1.5">
              {LOCK_TIMEOUTS.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={lockMin === m}
                  onClick={() => onChange({ ...config, lockAfterMin: m })}
                  className={[
                    "rounded-md border px-2.5 py-1 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    lockMin === m
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-foreground hover:bg-accent/40",
                  ].join(" ")}
                >
                  {m}분
                </button>
              ))}
            </div>
          </div>

          {/* 변경/해제 — 현재 비밀번호 확인 필요 */}
          <input
            type="password"
            value={cur}
            onChange={(e) => {
              setCur(e.target.value);
              setMsg(null);
            }}
            autoComplete="off"
            placeholder="현재 비밀번호 (변경·해제에 필요)"
            className={inputCls}
          />
          <div className="grid grid-cols-2 gap-1.5">
            <input
              type="password"
              value={np}
              onChange={(e) => {
                setNp(e.target.value);
                setMsg(null);
              }}
              autoComplete="new-password"
              placeholder="새 비밀번호"
              className={inputCls}
            />
            <input
              type="password"
              value={np2}
              onChange={(e) => {
                setNp2(e.target.value);
                setMsg(null);
              }}
              autoComplete="new-password"
              placeholder="새 비밀번호 확인"
              className={inputCls}
            />
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => void changePassword()}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
            >
              변경
            </button>
            <button
              type="button"
              onClick={() => void removePassword()}
              className="rounded-md border border-destructive px-3 py-1.5 text-sm text-destructive outline-none transition-colors hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring"
            >
              잠금 해제
            </button>
          </div>
        </div>
      )}

      {msg ? <p className="text-[11px] text-muted-foreground">{msg}</p> : null}
      <p className="text-[11px] leading-snug text-muted-foreground">
        ⚠ 화면 잠금만 제공합니다(내용은 서버에 평문 저장·RLS 보호). 진짜 비밀번호는
        저장하지 마세요. 강력한 보안이 필요하면 ‘비밀번호 금고’ 위젯을 쓰세요.
      </p>
    </fieldset>
  );
}

export default MemoConfigEditor;
