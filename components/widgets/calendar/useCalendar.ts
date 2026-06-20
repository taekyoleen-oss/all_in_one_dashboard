"use client";

/**
 * useCalendar — poll /api/calendar for the owner's upcoming events
 * (설계서 §2.2, dataMode:'poll').
 *
 *  Thin wrapper over the shared usePoll hook (the React-19-safe external-source
 *  pattern). Types are IMPORTED from output/api-shapes.ts (CalendarFeed) — never
 *  re-declared. The route ALWAYS returns 200: when Google isn't connected it
 *  sends `{ connected:false, events:[] }`, so this hook surfaces a distinct
 *  `connected` flag the views read to choose between the agenda and the
 *  "Google 연결" CTA. A connected-but-failed fetch carries `events:[]` + an
 *  `error` code while still being `connected:true`.
 *
 *  Instance isolation: every calendar widget polls the same per-user endpoint,
 *  but each owns its own subscription/state (the URL is constant, the data is
 *  the signed-in user's). There is no per-instance query string to drift.
 */

import { CalendarFeedSchema, type CalendarEvent } from "@/output/api-shapes";
import { usePoll } from "@/components/widgets/shared/usePoll";

/** Poll cadence for the calendar (5 min — agendas don't change second-to-second). */
export const CALENDAR_REFRESH_MS = 300_000;

const CALENDAR_URL = "/api/calendar";

export interface CalendarState {
  /** Whether the server had a usable Google connection. False ⇒ show the CTA. */
  connected: boolean;
  /** Upcoming events, soonest first (empty when not connected / none upcoming). */
  events: CalendarEvent[];
  /** True only during the very first load (no feed yet). */
  loading: boolean;
  /**
   * A soft error: either the poll itself failed with no data, or the connected
   * fetch degraded server-side (feed.error). Null when healthy.
   */
  error: string | null;
  /** epoch ms of the last successful poll (for a "갱신: …" line). */
  lastUpdated: number | null;
  /** Force an out-of-band refresh (after connecting, or a manual button). */
  refresh: () => void;
}

export function useCalendar(): CalendarState {
  const poll = usePoll<typeof CalendarFeedSchema>(CALENDAR_URL, CalendarFeedSchema, {
    intervalMs: CALENDAR_REFRESH_MS,
  });

  const feed = poll.data;

  return {
    // Until the first successful poll we optimistically assume "not connected"
    // so the tile shows the CTA rather than a spinner forever if the route is
    // unreachable; once a feed arrives, its flag is authoritative.
    connected: feed?.connected ?? false,
    events: feed?.events ?? [],
    loading: poll.loading,
    // Surface the server-side soft error (connected-but-fetch-failed) too.
    error: feed?.error ?? poll.error,
    lastUpdated: poll.lastUpdated,
    refresh: poll.refresh,
  };
}

export default useCalendar;
