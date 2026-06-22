"use client";

/**
 * upcoming · EventRow — 한 일정 카드(요일+날짜 / 이모지+제목+시간·장소 / D-day 배지).
 *
 *  레퍼런스 디자인(소프트 카드 + 따뜻한 강조색)을 테마 토큰 위에서 재현한다. 날짜와
 *  D-day 배지는 따뜻한 액센트(orange)로 강조하되, 카드/테두리/본문은 토큰을 써서
 *  다크·라이트 모두 자연스럽게 보이도록 한다. D-day는 색과 'D-' 문구로 함께 전달.
 */

import * as React from "react";
import { eventSubtitle, type EventReadout } from "./compute";

export function EventRow({
  readout,
  size = "compact",
}: {
  readout: EventReadout;
  size?: "compact" | "expanded";
}) {
  const big = size === "expanded";
  const subtitle = eventSubtitle(readout.event);
  const accent = "text-orange-500";

  return (
    <li
      className={[
        "flex items-center gap-3 rounded-xl border border-border bg-muted/30",
        big ? "px-4 py-3" : "px-3 py-2.5",
      ].join(" ")}
    >
      {/* 왼쪽: 요일 + 날짜 숫자 */}
      <div className="flex w-9 shrink-0 flex-col items-center leading-none">
        <span className={["text-[11px] font-medium", accent].join(" ")}>
          {readout.weekday}
        </span>
        <span
          className={[
            "font-bold tabular-nums",
            big ? "text-2xl" : "text-xl",
            accent,
          ].join(" ")}
        >
          {readout.day}
        </span>
      </div>

      {/* 가운데: 이모지 + 제목, 시간·장소 */}
      <div className="min-w-0 flex-1">
        <div
          className={[
            "flex items-center gap-1.5 font-semibold text-foreground",
            big ? "text-base" : "text-sm",
          ].join(" ")}
        >
          {readout.event.emoji ? (
            <span aria-hidden className="shrink-0">
              {readout.event.emoji}
            </span>
          ) : null}
          <span className="truncate">{readout.event.title || "(제목 없음)"}</span>
        </div>
        {subtitle ? (
          <p
            className={[
              "truncate text-muted-foreground",
              big ? "text-sm" : "text-xs",
            ].join(" ")}
          >
            {subtitle}
          </p>
        ) : null}
      </div>

      {/* 오른쪽: D-day 배지 */}
      <span
        className={[
          "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
          readout.isToday
            ? "bg-orange-500 text-white"
            : "border border-orange-500/50 text-orange-500",
        ].join(" ")}
      >
        {readout.ddayLabel}
      </span>
    </li>
  );
}

export default EventRow;
