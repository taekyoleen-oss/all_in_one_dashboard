"use client";

/** 시간대 선택 칩 (가로 스크롤). 원본 OUTFIT_PERIODS(7구간)를 그대로 사용. */

import * as React from "react";
import { OUTFIT_PERIODS } from "./constants";

export function PeriodPicker({
  value,
  onChange,
  size = "compact",
}: {
  value: string;
  onChange: (id: string) => void;
  size?: "compact" | "expanded";
}) {
  const big = size === "expanded";
  return (
    <div
      role="group"
      aria-label="시간대 선택"
      className="flex shrink-0 items-center gap-1 overflow-x-auto pb-scroll"
    >
      {OUTFIT_PERIODS.map((p) => {
        const active = p.id === value;
        return (
          <button
            key={p.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(p.id)}
            className={[
              "inline-flex shrink-0 items-center gap-1 rounded-full border outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              big ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[11px]",
              active
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border text-muted-foreground hover:bg-accent/40",
            ].join(" ")}
          >
            <span aria-hidden>{p.emoji}</span>
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

export default PeriodPicker;
