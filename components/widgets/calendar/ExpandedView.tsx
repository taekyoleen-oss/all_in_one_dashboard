"use client";

/**
 * calendar · ExpandedView — full agenda grouped by day (설계서 §2.2, §3.3).
 *
 *  Same poll subscription as compact, rendered larger: events grouped under day
 *  headings (오늘 / 내일 / "6월 24일 (화)"), a last-updated line, and a manual
 *  refresh. When not connected it shows the full "Google 연결" CTA. Connecting
 *  itself flows through the ConfigEditor (편집) too, but the CTA here lets the
 *  user link without opening settings.
 */

import * as React from "react";
import type { ExpandedViewProps } from "@/lib/widgets/contract";
import { useCalendar } from "./useCalendar";
import { ConnectCTA } from "./ConnectCTA";
import { EventRow } from "./EventRow";
import { groupByDay } from "./format";
import type { CalendarConfig } from "./types";

function formatTime(ts: number | null): string {
  if (ts === null) return "—";
  return new Date(ts).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CalendarExpandedView(_props: ExpandedViewProps<CalendarConfig>) {
  const { connected, events, loading, error, lastUpdated, refresh } =
    useCalendar();

  if (!connected) {
    if (loading) {
      return <p className="text-sm text-muted-foreground">일정 불러오는 중…</p>;
    }
    return <ConnectCTA />;
  }

  const groups = groupByDay(events);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>다가오는 일정</span>
        <button
          type="button"
          onClick={refresh}
          className="rounded-full border border-border px-2 py-0.5 text-foreground outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring"
        >
          새로고침
        </button>
      </div>

      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {error ? "일정을 불러오지 못했습니다." : "다가오는 일정이 없습니다."}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((group) => (
            <section key={group.dayMs} className="flex flex-col gap-1">
              <h3 className="text-xs font-medium text-muted-foreground">
                {group.label}
              </h3>
              <ul className="flex flex-col gap-1 rounded-[var(--radius)] border border-border bg-card/40 p-2">
                {group.events.map((ev) => (
                  <EventRow key={ev.id} event={ev} variant="agenda" />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Google 캘린더 · 기본 캘린더</span>
        <span>갱신: {formatTime(lastUpdated)}</span>
      </div>
    </div>
  );
}

export default CalendarExpandedView;
