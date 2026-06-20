"use client";

/**
 * calendar · EventRow — one upcoming event line.
 *
 *  Title + time + (optional) location. Time is shown as TEXT ("종일" / "오후 2:30")
 *  so the row reads without color; an all-day event is also marked via a
 *  `data-allday` attribute. In compact mode the day is folded into the line; in
 *  expanded mode the parent groups by day, so the row shows only the clock time.
 */

import * as React from "react";
import { MapPin } from "lucide-react";
import type { CalendarEvent } from "@/output/api-shapes";
import { eventTimeLabel, eventWhenLabel } from "./format";

export function EventRow({
  event,
  variant = "compact",
}: {
  event: CalendarEvent;
  /** "compact" folds the day into the time; "agenda" shows clock time only. */
  variant?: "compact" | "agenda";
}) {
  const time =
    variant === "compact" ? eventWhenLabel(event) : eventTimeLabel(event);

  return (
    <li
      data-allday={event.allDay}
      className="flex items-baseline justify-between gap-3 rounded-md px-1.5 py-1"
    >
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium text-foreground">
          {event.title}
        </span>
        {event.location ? (
          <span className="flex min-w-0 items-center gap-1 truncate text-[11px] text-muted-foreground">
            <MapPin size={11} aria-hidden className="shrink-0" />
            <span className="truncate">{event.location}</span>
          </span>
        ) : null}
      </div>
      <span className="shrink-0 whitespace-nowrap text-xs tabular-nums text-muted-foreground">
        {time}
      </span>
    </li>
  );
}

export default EventRow;
