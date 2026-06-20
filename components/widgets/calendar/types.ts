/**
 * calendar widget — config shape (설계서 §2.2 "캘린더", §3.3).
 *
 *  The widget reads the owner's upcoming Google Calendar events from
 *  /api/calendar (dataMode:'poll'). Event DATA never lives in config — only the
 *  display preference does. Auth is email magic link, so Calendar needs a
 *  separate Google connection (handled in ConfigEditor via signInWithOAuth);
 *  the connection STATE is global (pb_user_settings.google_connected / the feed's
 *  `connected` flag), not per-instance config.
 *
 *  Default = show up to 5 upcoming events.
 */

export interface CalendarConfig {
  /** How many upcoming events to show in the compact tile (1–10). */
  maxItems: number;
}

export const DEFAULT_CALENDAR_CONFIG: CalendarConfig = {
  maxItems: 5,
};

/** The Google scope the widget requests so the server can read the calendar. */
export const CALENDAR_OAUTH_SCOPES =
  "openid email https://www.googleapis.com/auth/calendar.readonly";
