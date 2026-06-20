"use client";

/**
 * card-usage · IngestSettings — per-user ingest token + Android forwarding guide
 * (설계서 §6.4, §5.2 인제스트 토큰).
 *
 *  Mints a per-user secret token CLIENT-side (`crypto.randomUUID()`) and upserts
 *  it into `pb_user_settings.ingest_token` via the browser client (RLS-scoped to
 *  the signed-in user). The phone's SMS-forwarding app then POSTs card SMS to
 *  `/api/cards/ingest` with this token in the `x-ingest-token` header; the route
 *  resolves the owning user from the token (server-side, service-role) and stores
 *  the parsed transaction.
 *
 *  The token is the ONLY credential the phone needs. It is shown so the user can
 *  copy it into the forwarder; "재발급" rotates it (the old token stops working).
 *  The token is a random UUID — NOT a password, NOT a card number — but it is a
 *  bearer secret, so the copy UI keeps it masked until revealed.
 */

import * as React from "react";
import { KeyRound, Copy, Check, RefreshCw, Eye, EyeOff, Smartphone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/** Absolute ingest URL for the guide (origin known only on the client). */
function ingestUrl(): string {
  if (typeof window === "undefined") return "/api/cards/ingest";
  return `${window.location.origin}/api/cards/ingest`;
}

export function IngestSettings() {
  const [token, setToken] = React.useState<string | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  const [revealed, setRevealed] = React.useState(false);
  const [copied, setCopied] = React.useState<"token" | "url" | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  // Load the existing token once (RLS-scoped read).
  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        setLoaded(true);
        return;
      }
      const { data } = await supabase
        .from("pb_user_settings")
        .select("ingest_token")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setToken(data?.ingest_token ?? null);
      setLoaded(true);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const generate = async () => {
    setBusy(true);
    setErr(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setErr("로그인이 필요합니다.");
      setBusy(false);
      return;
    }
    const next =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    // Upsert keeps other settings columns intact (defaults apply only on insert).
    const { error } = await supabase
      .from("pb_user_settings")
      .upsert({ user_id: user.id, ingest_token: next }, { onConflict: "user_id" });
    setBusy(false);
    if (error) {
      setErr("토큰을 저장하지 못했습니다.");
      return;
    }
    setToken(next);
    setRevealed(true);
  };

  const copy = async (what: "token" | "url", value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard blocked — ignore */
    }
  };

  const masked = token ? "•".repeat(Math.min(token.length, 36)) : "";

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-background/40 p-2.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <KeyRound size={14} aria-hidden />
        인제스트 설정 (안드로이드 SMS 자동 수집)
      </div>

      {!loaded ? (
        <p className="text-xs text-muted-foreground">불러오는 중…</p>
      ) : (
        <>
          {/* token row */}
          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">인제스트 토큰</span>
            {token ? (
              <div className="flex items-center gap-1.5">
                <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs text-foreground">
                  {revealed ? token : masked}
                </code>
                <button
                  type="button"
                  onClick={() => setRevealed((v) => !v)}
                  aria-pressed={revealed}
                  aria-label={revealed ? "토큰 가리기" : "토큰 보이기"}
                  className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <button
                  type="button"
                  onClick={() => copy("token", token)}
                  aria-label="토큰 복사"
                  className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {copied === "token" ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                </button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                아직 토큰이 없습니다. 아래에서 발급하세요.
              </p>
            )}
          </div>

          {err ? <p className="text-xs text-destructive">{err}</p> : null}

          <button
            type="button"
            onClick={generate}
            disabled={busy}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <RefreshCw size={14} aria-hidden />
            {token ? "토큰 재발급" : "토큰 발급"}
          </button>

          {/* forwarding guide */}
          <div className="flex flex-col gap-1.5 rounded-md border border-border bg-card/40 p-2.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <Smartphone size={14} aria-hidden />
              안드로이드 포워딩 설정
            </div>
            <ol className="ml-4 list-decimal space-y-1 text-[11px] leading-relaxed text-muted-foreground">
              <li>
                폰에 <strong>SMS Forwarder</strong> / <strong>MacroDroid</strong> /
                <strong> Tasker</strong> 중 하나를 설치합니다.
              </li>
              <li>
                <strong>발신번호 필터 = 카드사</strong> (예: 신한·국민·삼성 카드사
                발신번호)로 규칙을 만듭니다.
              </li>
              <li>
                전송 방식 = <strong>HTTP POST</strong>, 본문 = 받은 문자 내용 그대로
                (<code>text</code> 필드 또는 plain text).
              </li>
            </ol>

            <div className="mt-1 flex flex-col gap-1.5">
              <span className="text-[11px] text-muted-foreground">전송 URL</span>
              <div className="flex items-center gap-1.5">
                <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-background px-2 py-1 font-mono text-[11px] text-foreground">
                  {ingestUrl()}
                </code>
                <button
                  type="button"
                  onClick={() => copy("url", ingestUrl())}
                  aria-label="URL 복사"
                  className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {copied === "url" ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                </button>
              </div>
              <span className="text-[11px] text-muted-foreground">
                헤더: <code>x-ingest-token: 위 토큰</code>
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              인식하지 못한 문자도 버리지 않고 <strong>미인식</strong>으로 보관되니,
              나중에 확인·수정할 수 있습니다.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

export default IngestSettings;
