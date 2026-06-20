"use client";

/**
 * calendar · CompactView — upcoming events on the canvas tile (설계서 §2.2, §3.3).
 *
 *  Polls /api/calendar via useCalendar. Three states, all non-crashing:
 *    • not connected → a compact "Google 연결" CTA (the normal first state for a
 *      magic-link account — never an error).
 *    • connected, has events → a short upcoming list ("오늘 · 오후 2:30 — 회의").
 *    • connected, none → a calm "다가오는 일정이 없습니다." line.
 *  Reflows by @container width; `maxItems` comes from this instance's config (격리).
 */

import * as React from "react";
import type { CompactViewProps } from "@/lib/widgets/contract";
import { useCalendar } from "./useCalendar";
import { ConnectCTA } from "./ConnectCTA";
import { EventRow } from "./EventRow";
import type { CalendarConfig } from "./types";

export function CalendarCompactView({ config }: CompactViewProps<CalendarConfig>) {
  const { connected, events, loading, error } = useCalendar();

  if (loading && events.length === 0 && !connected) {
    return <p className="text-sm text-muted-foreground">일정 불러오는 중…</p>;
  }

  // The defining state for a magic-link account: no Google link yet → show CTA.
  if (!connected) {
    return <ConnectCTA compact />;
  }

  const shown = events.slice(0, Math.max(1, config.maxItems));

  if (shown.length === 0) {
    return (
      <div className="flex h-full flex-col justify-center">
        <p className="text-sm text-muted-foreground">
          {error ? "일정을 불러오지 못했습니다." : "다가오는 일정이 없습니다."}
        </p>
      </div>
    );
  }

  return (
    <ul className="flex h-full min-h-0 flex-col gap-0.5 overflow-y-auto pb-scroll">
      {shown.map((ev) => (
        <EventRow key={ev.id} event={ev} variant="compact" />
      ))}
    </ul>
  );
}

export default CalendarCompactView;
