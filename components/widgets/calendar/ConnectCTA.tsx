"use client";

/**
 * calendar · ConnectCTA — the "Google 연결" call-to-action (설계서 §3.3).
 *
 *  Shown whenever the feed reports `connected:false`. Auth is email magic link,
 *  so Calendar needs a SEPARATE Google link: clicking this starts
 *  signInWithOAuth({ provider:'google' }) with the `calendar.readonly` scope +
 *  offline access (so the server gets a refreshable provider token), and returns
 *  to /auth/callback. After Google grants the scope, the Supabase session carries
 *  a `provider_token` the server uses to read the calendar.
 *
 *  This is a degrade-state CTA, NOT an error: the widget renders fine without a
 *  connection. `compact` shrinks it for the canvas tile vs. the expanded view.
 */

import * as React from "react";
import { CalendarClock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CALENDAR_OAUTH_SCOPES } from "./types";

export function ConnectCTA({ compact = false }: { compact?: boolean }) {
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const connect = React.useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          scopes: CALENDAR_OAUTH_SCOPES,
          // offline + consent so Google returns a refresh token (server can renew
          // the provider token without re-prompting every hour).
          queryParams: { access_type: "offline", prompt: "consent" },
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      // On success the browser is redirected to Google; we only land here on error.
      if (error) {
        setErr("연결을 시작하지 못했습니다. 잠시 후 다시 시도하세요.");
        setBusy(false);
      }
    } catch {
      setErr("연결을 시작하지 못했습니다. 잠시 후 다시 시도하세요.");
      setBusy(false);
    }
  }, []);

  return (
    <div
      className={[
        "flex h-full flex-col items-center justify-center gap-2 text-center",
        compact ? "px-2" : "px-4 py-6",
      ].join(" ")}
    >
      <CalendarClock
        size={compact ? 22 : 28}
        aria-hidden
        className="text-muted-foreground"
      />
      <p className={compact ? "text-xs text-muted-foreground" : "text-sm text-muted-foreground"}>
        {compact
          ? "Google 캘린더를 연결하면 일정이 표시됩니다."
          : "Google 캘린더를 연결하면 다가오는 일정을 여기에서 볼 수 있습니다."}
      </p>
      <button
        type="button"
        onClick={connect}
        disabled={busy}
        className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        {busy ? "연결 중…" : "Google 연결"}
      </button>
      {err ? <p className="text-xs text-destructive">{err}</p> : null}
    </div>
  );
}

export default ConnectCTA;
