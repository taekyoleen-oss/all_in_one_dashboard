"use client";

/**
 * essential-info · ExpandedView — full list with reveal + per-field copy (§2.1 #6).
 *
 *  Renders from `config`. Masked values stay hidden until explicitly revealed
 *  (per-instance, ephemeral). copyBehavior: 'custom' — each row copies its single
 *  value. Per the frozen contract there is no onChange here, so add/edit/remove
 *  flows through the ConfigEditor (편집); a hint points there.
 */

import * as React from "react";
import { Eye, EyeOff, Copy, Check } from "lucide-react";
import type { ExpandedViewProps } from "@/lib/widgets/contract";
import { useCopy } from "@/lib/utils/useCopy";
import { maskOf, type EssentialInfoConfig } from "./types";

export function EssentialInfoExpandedView({
  config,
}: ExpandedViewProps<EssentialInfoConfig>) {
  const [revealed, setRevealed] = React.useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const { copiedKey, copy } = useCopy();

  const toggle = (id: string) =>
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (config.items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        정보가 없습니다. 위젯 메뉴의 “편집”에서 추가하세요.
      </p>
    );
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col gap-4">
      <ul className="flex flex-col gap-2">
        {config.items.map((it) => {
          const isRevealed = revealed.has(it.id);
          const show = !it.masked || isRevealed;
          const copied = copiedKey === it.id;
          return (
            <li
              key={it.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-card/60 px-3 py-2"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">
                  {it.label || "(라벨 없음)"}
                </span>
                <span
                  className={[
                    "min-w-0 break-words text-base text-foreground",
                    show ? "" : "font-mono tracking-widest",
                  ].join(" ")}
                >
                  {it.value ? (show ? it.value : maskOf(it.value)) : "—"}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {it.masked && it.value ? (
                  <button
                    type="button"
                    onClick={() => toggle(it.id)}
                    aria-pressed={isRevealed}
                    aria-label={`${it.label || "값"} ${isRevealed ? "가리기" : "보이기"}`}
                    className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {isRevealed ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                ) : null}
                {it.value ? (
                  <button
                    type="button"
                    onClick={() => copy(it.value, it.id)}
                    aria-label={`${it.label || "값"} 복사${copied ? " (복사됨)" : ""}`}
                    className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {copied ? <Check size={15} /> : <Copy size={15} />}
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">
        항목 추가·수정·삭제는 위젯 메뉴의 “편집”에서 할 수 있습니다.
      </p>
    </div>
  );
}

export default EssentialInfoExpandedView;
