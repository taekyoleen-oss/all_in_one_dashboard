"use client";

/**
 * memo · ConfigEditor — body text + accent color + size (설계서 §2.1 #2).
 *
 *  Reports every change up via onChange; the parent (ConfigDialog) owns the draft
 *  + persistence. Pure controlled inputs — no local mirror of config.
 */

import * as React from "react";
import type { ConfigEditorProps } from "@/lib/widgets/contract";
import {
  MEMO_COLORS,
  MEMO_TEXT_COLORS,
  type MemoColor,
  type MemoConfig,
  type MemoSize,
} from "./types";

const SIZE_ORDER: MemoSize[] = ["sm", "md", "lg"];
const SIZE_LABEL: Record<MemoSize, string> = { sm: "작게", md: "보통", lg: "크게" };
const COLOR_ORDER = Object.keys(MEMO_COLORS) as MemoColor[];

export function MemoConfigEditor({ config, onChange }: ConfigEditorProps<MemoConfig>) {
  return (
    <div className="flex flex-col gap-4">
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

export default MemoConfigEditor;
