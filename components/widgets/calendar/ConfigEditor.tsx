"use client";

/**
 * calendar · ConfigEditor — Google 연결 + display options (설계서 §2.2, §3.3, §9.7).
 *
 *  Two parts:
 *    1. Google 연결 — the owner signed in with a magic link, so Calendar needs a
 *       separate Google link. This button starts
 *       signInWithOAuth({ provider:'google' }) with the `calendar.readonly` scope
 *       + offline access, returning to /auth/callback. A status badge shows
 *       연결됨 / 미연결, read from BOTH the live feed (connected) AND
 *       pb_user_settings.google_connected (whichever proves a connection). A short
 *       note explains the one-time owner setup (enable the Google provider in
 *       Supabase + set GOOGLE_CLIENT_ID/SECRET) so the flow can go live.
 *    2. 표시 옵션 — how many upcoming events the compact tile shows (1–10).
 *
 *  Controlled: reports the whole next config via onChange (the dialog owns the
 *  draft; the parent owns persistence). No secrets are handled here — the
 *  provider token never reaches the client.
 */

import * as React from "react";
import { CheckCircle2, CircleSlash } from "lucide-react";
import type { ConfigEditorProps } from "@/lib/widgets/contract";
import { createClient } from "@/lib/supabase/client";
import { CalendarFeedSchema } from "@/output/api-shapes";
import { CALENDAR_OAUTH_SCOPES, type CalendarConfig } from "./types";

const MIN_ITEMS = 1;
const MAX_ITEMS = 10;

export function CalendarConfigEditor({
  config,
  onChange,
}: ConfigEditorProps<CalendarConfig>) {
  // null = still resolving; true/false = known connection state.
  const [connected, setConnected] = React.useState<boolean | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  // Resolve the connection state from BOTH sources (the live feed is the most
  // authoritative; pb_user_settings.google_connected is the persisted hint set
  // after a successful link). Either being true means "connected".
  React.useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      let isConnected = false;

      // 1) Persisted flag (pb_user_settings, RLS-scoped to the owner).
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("pb_user_settings")
          .select("google_connected")
          .maybeSingle();
        if (data?.google_connected) isConnected = true;
      } catch {
        // ignore — fall through to the live feed check
      }

      // 2) Live feed — proves the server actually has a usable provider token.
      if (!isConnected) {
        try {
          const res = await fetch("/api/calendar", { cache: "no-store" });
          if (res.ok) {
            const parsed = CalendarFeedSchema.safeParse(await res.json());
            if (parsed.success && parsed.data.connected) isConnected = true;
          }
        } catch {
          // ignore — leave as not connected
        }
      }

      if (!cancelled) setConnected(isConnected);
    };

    void resolve();
    return () => {
      cancelled = true;
    };
  }, []);

  const connect = React.useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          scopes: CALENDAR_OAUTH_SCOPES,
          queryParams: { access_type: "offline", prompt: "consent" },
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        setErr("연결을 시작하지 못했습니다. 잠시 후 다시 시도하세요.");
        setBusy(false);
      }
      // On success the browser redirects to Google; nothing else to do here.
    } catch {
      setErr("연결을 시작하지 못했습니다. 잠시 후 다시 시도하세요.");
      setBusy(false);
    }
  }, []);

  const setMaxItems = (raw: number) => {
    const n = Math.min(MAX_ITEMS, Math.max(MIN_ITEMS, Math.round(raw)));
    onChange({ ...config, maxItems: n });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 1) Google connection */}
      <fieldset className="flex flex-col gap-2 rounded-md border border-border p-3">
        <legend className="px-1 text-xs font-medium text-muted-foreground">
          Google 연결
        </legend>

        <div className="flex items-center justify-between gap-2">
          <ConnectionBadge connected={connected} />
          <button
            type="button"
            onClick={connect}
            disabled={busy}
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {busy ? "연결 중…" : connected ? "다시 연결" : "Google 연결"}
          </button>
        </div>

        {err ? <p className="text-xs text-destructive">{err}</p> : null}

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          이메일 매직링크로 로그인했기 때문에 캘린더는 Google 계정을 별도로 연결해야
          합니다. “Google 연결”을 누르면 캘린더 읽기 권한을 요청합니다.
        </p>
        <p className="rounded-md bg-muted/50 px-2 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
          관리자 설정(최초 1회): Supabase 대시보드 → Authentication → Providers에서
          Google 공급자를 켜고 <code className="font-mono">GOOGLE_CLIENT_ID</code> /
          <code className="font-mono"> GOOGLE_CLIENT_SECRET</code>를 입력하면 연결이
          활성화됩니다.
        </p>
      </fieldset>

      {/* 2) Display options */}
      <fieldset className="flex flex-col gap-2 rounded-md border border-border p-3">
        <legend className="px-1 text-xs font-medium text-muted-foreground">
          표시 옵션
        </legend>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          타일에 표시할 일정 수
          <input
            type="number"
            min={MIN_ITEMS}
            max={MAX_ITEMS}
            value={config.maxItems}
            onChange={(e) => setMaxItems(Number(e.target.value))}
            className="w-24 rounded-md border border-border bg-background px-2 py-1.5 text-sm tabular-nums text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <p className="text-[11px] text-muted-foreground">
          1–{MAX_ITEMS}개. 펼친 보기에서는 날짜별로 모두 표시됩니다.
        </p>
      </fieldset>
    </div>
  );
}

/** 연결됨 / 미연결 / 확인 중 badge — uses an icon + text (never color-only). */
function ConnectionBadge({ connected }: { connected: boolean | null }) {
  if (connected === null) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        연결 상태 확인 중…
      </span>
    );
  }
  if (connected) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-positive">
        <CheckCircle2 size={15} aria-hidden />
        연결됨
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      <CircleSlash size={15} aria-hidden />
      미연결
    </span>
  );
}

export default CalendarConfigEditor;
