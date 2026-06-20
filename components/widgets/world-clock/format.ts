/**
 * world-clock · Intl formatting helpers (client-only, no external API).
 */

import type { WorldClockConfig } from "./types";

export interface ZoneReadout {
  time: string;
  date: string;
  /** e.g. "GMT+9" — coarse offset label for context. */
  offset: string;
}

/** Format a single zone for the given instant + display options. */
export function formatZone(
  now: Date,
  timeZone: string,
  opts: Pick<WorldClockConfig, "hour12" | "showSeconds">,
): ZoneReadout {
  try {
    const time = new Intl.DateTimeFormat("ko-KR", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      ...(opts.showSeconds ? { second: "2-digit" } : {}),
      hour12: opts.hour12,
    }).format(now);

    const date = new Intl.DateTimeFormat("ko-KR", {
      timeZone,
      month: "short",
      day: "numeric",
      weekday: "short",
    }).format(now);

    const offset = offsetLabel(now, timeZone);
    return { time, date, offset };
  } catch {
    return { time: "—", date: "잘못된 시간대", offset: "" };
  }
}

/** Derive a "GMT±H" style label from the zone's longOffset name part. */
function offsetLabel(now: Date, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
    }).formatToParts(now);
    const tzn = parts.find((p) => p.type === "timeZoneName")?.value;
    return tzn ?? "";
  } catch {
    return "";
  }
}
