/**
 * ============================================================================
 *  GET /api/calendar — upcoming Google Calendar events (설계서 §2.2, §3.3, §11.1)
 * ============================================================================
 *
 *  The owner signs in with an email magic link, so Calendar needs a SEPARATE
 *  Google connection: the widget links Google with the `calendar.readonly` scope
 *  (signInWithOAuth), and the Supabase session then carries a `provider_token`.
 *  This route reads that token SERVER-SIDE and calls the Google Calendar API on
 *  the user's behalf. The token is NEVER returned to the client or logged.
 *
 *  DEGRADE-FIRST (the whole point of this route):
 *    • No session / no `provider_token` (Google not connected, or it was a plain
 *      magic-link session) → HTTP 200 `{ connected:false, events:[] }`. This is a
 *      NORMAL state — the widget shows the "Google 연결" CTA, never crashes.
 *    • Token expired / 401 / 403 (refresh failed, scope revoked) → also degrades
 *      to `connected:false` so the widget re-prompts to connect.
 *    • Google reachable-but-erroring (5xx/network) while connected → returns
 *      `{ connected:true, events:[], error:'fetch_failed' }` so the widget can
 *      show a soft notice but still render.
 *
 *  Output is validated against CalendarFeedSchema (output/api-shapes.ts — the
 *  anti-drift single source) before it leaves. No-store + private: this is
 *  per-user authenticated data, so it must never be shared-cached.
 *
 *  Route Handler (Next.js 16). Reads cookies (the session) → dynamic; we set
 *  Cache-Control: private, no-store explicitly.
 * ============================================================================
 */

import { createClient } from "@/lib/supabase/server";
import { CalendarFeedSchema, type CalendarFeed } from "@/output/api-shapes";

/** Max upcoming events we pull/return (a widget shows a short list). */
const MAX_EVENTS = 10;
/** How far ahead to look (Google needs a bound; 60d is plenty for "upcoming"). */
const WINDOW_DAYS = 60;
/** Hard timeout for the Google call so a hung upstream can't wedge the tile. */
const FETCH_TIMEOUT_MS = 8000;

/** This route never shared-caches: the payload is per-user authenticated data. */
const NO_STORE = { "cache-control": "private, no-store" } as const;

/** A connected-but-failed fetch still renders; an unconnected one shows the CTA. */
function feed(
  connected: boolean,
  events: CalendarFeed["events"],
  error?: string,
): CalendarFeed {
  return { connected, events, error, ts: Date.now() };
}

/** Validate our own output against the shared schema (catches accidental drift). */
function respond(body: CalendarFeed) {
  const parsed = CalendarFeedSchema.safeParse(body);
  return Response.json(parsed.success ? parsed.data : body, {
    headers: NO_STORE,
  });
}

/* --- Google Calendar `events.list` (minimal subset we consume) -------------- */

interface GCalDate {
  /** RFC3339 timestamp for timed events (e.g. "2026-06-20T09:00:00+09:00"). */
  dateTime?: string;
  /** yyyy-mm-dd for all-day events (no clock). */
  date?: string;
  timeZone?: string;
}
interface GCalEvent {
  id?: string;
  status?: string;
  summary?: string;
  location?: string;
  start?: GCalDate;
  end?: GCalDate;
}
interface GCalListResponse {
  items?: GCalEvent[];
}

/** Epoch ms for an all-day `date` (yyyy-mm-dd) at LOCAL midnight, or null. */
function allDayMs(date: string | undefined): number | null {
  if (!date) return null;
  const ms = new Date(`${date}T00:00:00`).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** Epoch ms for a timed `dateTime` (RFC3339), or null. */
function timedMs(dateTime: string | undefined): number | null {
  if (!dateTime) return null;
  const ms = new Date(dateTime).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** Normalize one Google event → our CalendarEvent shape (or null to drop it). */
function normalize(ev: GCalEvent): CalendarFeed["events"][number] | null {
  if (!ev.id || ev.status === "cancelled") return null;

  const allDay = Boolean(ev.start?.date && !ev.start?.dateTime);
  const start = allDay ? allDayMs(ev.start?.date) : timedMs(ev.start?.dateTime);
  if (start === null) return null;

  // End is best-effort: fall back to start so a missing/garbled end can't NaN.
  const rawEnd = allDay ? allDayMs(ev.end?.date) : timedMs(ev.end?.dateTime);
  const end = rawEnd ?? start;

  const title = ev.summary?.trim() || "(제목 없음)";
  const location = ev.location?.trim();

  return {
    id: ev.id,
    title,
    start,
    end,
    allDay,
    ...(location ? { location } : {}),
    calendar: "기본",
  };
}

export async function GET() {
  // Read the session SERVER-SIDE. `provider_token` lives on the Session object
  // (not in the JWT claims), so getSession() is the way to reach it here.
  let providerToken: string | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    providerToken = session?.provider_token ?? null;
  } catch {
    // Cookie/store read failed — treat as not connected (never throw to client).
    return respond(feed(false, []));
  }

  // No Google connection (plain magic-link session, or never linked) → CTA state.
  if (!providerToken) {
    return respond(feed(false, []));
  }

  // --- Connected: call the Google Calendar API with the provider token. -------
  const timeMin = new Date().toISOString();
  const timeMax = new Date(
    Date.now() + WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true", // expand recurring events into instances
    orderBy: "startTime", // only valid alongside singleEvents=true
    maxResults: String(MAX_EVENTS),
  });
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${providerToken}` },
      cache: "no-store",
      signal: controller.signal,
    });
  } catch {
    // Network error / timeout while connected → soft error, still render.
    return respond(feed(true, [], "fetch_failed"));
  } finally {
    clearTimeout(timer);
  }

  // 401/403 → the token is expired/revoked or lacks the calendar scope. Degrade
  // to the unconnected state so the widget re-prompts the user to connect.
  if (res.status === 401 || res.status === 403) {
    return respond(feed(false, []));
  }
  if (!res.ok) {
    return respond(feed(true, [], "fetch_failed"));
  }

  let json: GCalListResponse;
  try {
    json = (await res.json()) as GCalListResponse;
  } catch {
    return respond(feed(true, [], "fetch_failed"));
  }

  const events = (json.items ?? [])
    .map(normalize)
    .filter((e): e is CalendarFeed["events"][number] => e !== null)
    .sort((a, b) => a.start - b.start)
    .slice(0, MAX_EVENTS);

  return respond(feed(true, events));
}
