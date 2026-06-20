"use client";

/**
 * essential-info · CompactView — label+value rows with per-row masking (§2.1 #6).
 *
 *  Renders from `config`. Masked rows show a dot mask until the user explicitly
 *  reveals them (Eye toggle) — reveal is local UI state per instance and never
 *  auto-reveals. Sensitive values are never logged. Color is never the only
 *  signal: an explicit Eye/EyeOff icon + aria-pressed conveys the masked state.
 */

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import type { CompactViewProps } from "@/lib/widgets/contract";
import { maskOf, type EssentialInfoConfig } from "./types";

export function EssentialInfoCompactView({
  config,
}: CompactViewProps<EssentialInfoConfig>) {
  // Which masked rows are currently revealed (local, per-instance, ephemeral).
  const [revealed, setRevealed] = React.useState<ReadonlySet<string>>(
    () => new Set(),
  );
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
        정보가 없습니다. 편집에서 추가하세요.
      </p>
    );
  }

  return (
    <ul className="flex h-full flex-col justify-center gap-1.5">
      {config.items.map((it) => {
        const isRevealed = revealed.has(it.id);
        const show = !it.masked || isRevealed;
        return (
          <li
            key={it.id}
            className="flex items-center justify-between gap-2 border-b border-border/50 pb-1 last:border-0 last:pb-0"
          >
            <span className="shrink-0 text-xs text-muted-foreground">
              {it.label || "(라벨 없음)"}
            </span>
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                className={[
                  "min-w-0 truncate text-sm text-foreground",
                  show ? "" : "font-mono tracking-widest",
                ].join(" ")}
              >
                {it.value ? (show ? it.value : maskOf(it.value)) : "—"}
              </span>
              {it.masked && it.value ? (
                <button
                  type="button"
                  onClick={() => toggle(it.id)}
                  aria-pressed={isRevealed}
                  aria-label={`${it.label || "값"} ${isRevealed ? "가리기" : "보이기"}`}
                  className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {isRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export default EssentialInfoCompactView;
