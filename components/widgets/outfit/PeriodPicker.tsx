"use client";

/**
 * 시간대 선택 칩 (가로 스크롤). 맨 앞 '지금'(자동, 현재 시각 추적) +
 * '현재→미래' 롤링 슬롯(오늘 남은 구간 → 내일). 슬롯은 useSelectedPeriod가 만들어 넘긴다.
 * 오늘→내일 경계에는 '내일' 구분 라벨을 끼워 날짜를 구분한다(칩 라벨은 시각만).
 */

import * as React from "react";
import { AUTO_PERIOD_ID, type PeriodSlot } from "./constants";

export function PeriodPicker({
  value,
  onChange,
  slots,
  size = "compact",
}: {
  value: string;
  onChange: (id: string) => void;
  slots: PeriodSlot[];
  size?: "compact" | "expanded";
}) {
  const big = size === "expanded";
  // tomorrow=true인 칩(내일 시간대)은 비활성 시 회색 배경으로 오늘과 시각 구별.
  const chipClass = (active: boolean, tomorrow = false) =>
    [
      "inline-flex shrink-0 items-center gap-1 rounded-full border outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
      big ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[11px]",
      active
        ? "border-primary bg-primary/10 text-foreground"
        : tomorrow
          ? "border-border bg-muted text-muted-foreground hover:bg-muted/70"
          : "border-border text-muted-foreground hover:bg-accent/40",
    ].join(" ");

  return (
    <div
      role="group"
      aria-label="시간대 선택"
      className="flex shrink-0 items-center gap-1 overflow-x-auto pb-scroll"
    >
      {/* 지금(자동 추적) */}
      <button
        type="button"
        aria-pressed={value === AUTO_PERIOD_ID}
        onClick={() => onChange(AUTO_PERIOD_ID)}
        className={chipClass(value === AUTO_PERIOD_ID)}
      >
        <span aria-hidden>⏱</span>
        지금
      </button>

      {slots.map((s, i) => {
        const active = s.key === value;
        // 오늘→내일 경계에 '내일' 구분 라벨.
        const dayBreak = i > 0 && slots[i - 1].dayOffset !== s.dayOffset;
        return (
          <React.Fragment key={s.key}>
            {dayBreak ? (
              <span
                aria-hidden
                className="shrink-0 select-none px-1 text-[10px] font-medium text-muted-foreground"
              >
                내일
              </span>
            ) : null}
            <button
              type="button"
              aria-pressed={active}
              aria-label={`${s.dayOffset === 1 ? "내일 " : ""}${s.label}`}
              onClick={() => onChange(s.key)}
              className={chipClass(active, s.dayOffset === 1)}
            >
              <span aria-hidden>{s.emoji}</span>
              {s.label}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default PeriodPicker;
