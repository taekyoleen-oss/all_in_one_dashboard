"use client";

/**
 * essential-info · ConfigEditor — manage rows + D5 sensitive-info warning (§5.2/§5.3).
 *
 *  Surfaces a PROMINENT warning that truly sensitive secrets must not be stored
 *  here (주민번호·카드번호 전체·비밀번호·계좌 비밀번호) — only medium-grade info
 *  (법인등록번호·주소 등). Input is NOT blocked (per D5: warn, don't block). All
 *  changes report up via onChange (parent owns persistence). Per-row `masked`
 *  toggle controls reveal-on-tap in the views.
 */

import * as React from "react";
import { AlertTriangle, ArrowUp, ArrowDown, Trash2, Plus } from "lucide-react";
import type { ConfigEditorProps } from "@/lib/widgets/contract";
import type { EssentialInfoConfig, InfoItem } from "./types";

function newItemId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `ei-${crypto.randomUUID().slice(0, 6)}`
    : `ei-${Math.random().toString(36).slice(2, 8)}`;
}

export function EssentialInfoConfigEditor({
  config,
  onChange,
}: ConfigEditorProps<EssentialInfoConfig>) {
  const setItems = (items: InfoItem[]) => onChange({ ...config, items });

  const patch = (id: string, fields: Partial<InfoItem>) =>
    setItems(config.items.map((it) => (it.id === id ? { ...it, ...fields } : it)));

  const remove = (id: string) =>
    setItems(config.items.filter((it) => it.id !== id));

  const move = (index: number, dir: -1 | 1) => {
    const next = [...config.items];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
  };

  const add = () => {
    setItems([
      ...config.items,
      { id: newItemId(), label: "", value: "", masked: true },
    ]);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* D5 sensitive-info warning — prominent, non-blocking. */}
      <div
        role="note"
        className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-foreground"
      >
        <AlertTriangle
          size={16}
          aria-hidden
          className="mt-0.5 shrink-0 text-destructive"
        />
        <p className="leading-relaxed">
          <span className="font-semibold text-destructive">민감정보 저장 금지:</span>{" "}
          주민등록번호·카드번호 전체·비밀번호·계좌 비밀번호 등 진짜 민감한 정보는
          저장하지 마세요. 법인등록번호·주소 등 <strong>중간 수준</strong> 정보만
          입력하세요. 입력값은 본인만 접근할 수 있도록 보호되지만, 위 정보는
          저장 대상이 아닙니다.
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {config.items.map((it, i) => (
          <li
            key={it.id}
            className="flex flex-col gap-2 rounded-md border border-border bg-background/40 p-2"
          >
            <div className="flex items-center gap-2">
              <input
                value={it.label}
                onChange={(e) => patch(it.id, { label: e.target.value })}
                placeholder="라벨 (예: 주소)"
                className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <button
                type="button"
                aria-label={`${it.label || "항목"} 위로`}
                disabled={i === 0}
                onClick={() => move(i, -1)}
                className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30"
              >
                <ArrowUp size={15} />
              </button>
              <button
                type="button"
                aria-label={`${it.label || "항목"} 아래로`}
                disabled={i === config.items.length - 1}
                onClick={() => move(i, 1)}
                className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30"
              >
                <ArrowDown size={15} />
              </button>
              <button
                type="button"
                aria-label={`${it.label || "항목"} 삭제`}
                onClick={() => remove(it.id)}
                className="inline-flex size-7 items-center justify-center rounded-md text-destructive outline-none transition-colors hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Trash2 size={15} />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <input
                value={it.value}
                onChange={(e) => patch(it.id, { value: e.target.value })}
                placeholder="값"
                autoComplete="off"
                className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <label className="flex items-center gap-1.5 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={it.masked}
                  onChange={(e) => patch(it.id, { masked: e.target.checked })}
                  className="size-4 accent-[var(--primary)]"
                />
                가리기
              </label>
            </div>
          </li>
        ))}
        {config.items.length === 0 ? (
          <li className="rounded-md border border-dashed border-border px-2 py-3 text-center text-xs text-muted-foreground">
            추가된 정보가 없습니다.
          </li>
        ) : null}
      </ul>

      <button
        type="button"
        onClick={add}
        className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Plus size={15} aria-hidden />
        정보 추가
      </button>
    </div>
  );
}

export default EssentialInfoConfigEditor;
