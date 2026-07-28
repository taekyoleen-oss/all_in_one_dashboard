"use client";

/**
 * memo · ConfigEditor — 스타일 편집 (accent color · text color · size · 비밀번호).
 *
 *  내용 편집은 여기 없다(editInFocus): 메뉴의 '편집'(전체 화면) 또는 타일에서
 *  바로 입력. Reports every change up via onChange; the parent (ConfigDialog)
 *  owns the draft + persistence (비밀번호 섹션만 즉시 영속).
 */

import * as React from "react";
import { Lock } from "lucide-react";
import type { ConfigEditorProps } from "@/lib/widgets/contract";
import { useSaveWidgetConfig } from "@/lib/widgets/persistence";
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

export function MemoConfigEditor({
  config,
  onChange,
  instanceId,
}: ConfigEditorProps<MemoConfig>) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[11px] text-muted-foreground">
        메모 <b>내용</b>은 메뉴의 <b>‘편집’</b>(전체 화면)이나 타일에서 바로
        입력해요. 여기서는 색상·글자·비밀번호를 설정합니다.
      </p>

      <MemoPasswordSection
        config={config}
        onChange={onChange}
        instanceId={instanceId}
      />

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
  instanceId,
}: {
  config: MemoConfig;
  onChange: (next: MemoConfig) => void;
  instanceId?: string;
}) {
  const save = useSaveWidgetConfig();
  const has = !!config.pwHash;
  const [cur, setCur] = React.useState("");
  const [np, setNp] = React.useState("");
  const [np2, setNp2] = React.useState("");
  const [msg, setMsg] = React.useState<string | null>(null);
  const lockMin = config.lockAfterMin || 5;

  // 비밀번호 변경은 '즉시' 유지돼야 한다(요구: 설정하면 계속 유지, 취소로 사라지지
  // 않음). draft 갱신(onChange) + 인스턴스 config 즉시 영속(save) 둘 다 수행 →
  // 다이얼로그의 '저장'을 누르지 않아도 반영되고, 설정 즉시 타일이 잠긴다.
  const apply = React.useCallback(
    (next: MemoConfig) => {
      onChange(next);
      if (instanceId) save(instanceId, next);
    },
    [onChange, save, instanceId],
  );

  const setPassword = async () => {
    if (np.trim().length < 4) return setMsg("비밀번호는 4자 이상이어야 합니다.");
    if (np !== np2) return setMsg("비밀번호 확인이 일치하지 않습니다.");
    const h = await hashPassword(np);
    apply({ ...config, pwHash: h, lockAfterMin: config.lockAfterMin ?? 5 });
    setNp("");
    setNp2("");
    setMsg("잠금이 설정되었습니다. 타일이 바로 잠깁니다.");
  };

  const changePassword = async () => {
    const ch = await hashPassword(cur);
    if (!ch || ch !== config.pwHash) return setMsg("현재 비밀번호가 올바르지 않습니다.");
    if (np.trim().length < 4) return setMsg("새 비밀번호는 4자 이상이어야 합니다.");
    if (np !== np2) return setMsg("새 비밀번호 확인이 일치하지 않습니다.");
    const h = await hashPassword(np);
    apply({ ...config, pwHash: h });
    setCur("");
    setNp("");
    setNp2("");
    setMsg("비밀번호가 변경되었습니다.");
  };

  const removePassword = async () => {
    const ch = await hashPassword(cur);
    if (!ch || ch !== config.pwHash) return setMsg("현재 비밀번호가 올바르지 않습니다.");
    apply({ ...config, pwHash: null });
    setCur("");
    setMsg("잠금이 해제되었습니다. 일반 메모로 사용합니다.");
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
                  onClick={() => apply({ ...config, lockAfterMin: m })}
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
