"use client";

/**
 * ============================================================================
 *  /login — passwordless email magic-link sign-in (설계서 §3.1, §3.3)
 * ============================================================================
 *
 *  Single-user app: only `ALLOWED_EMAIL` may ultimately sign in. This page only
 *  *requests* a magic link (`supabase.auth.signInWithOtp`) — the actual
 *  allow-list enforcement happens server-side at /auth/callback and in proxy.ts,
 *  so we never leak the owner's address here. We simply show a generic
 *  "메일함을 확인하세요" sent-state and let the link itself be the gate.
 *
 *  Client Component: needs form state + the browser Supabase client + `location`.
 *  Token-styled to match the canvas (Calm Dashboard tokens, dark default).
 * ============================================================================
 */

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Mail, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

type Status = "idle" | "sending" | "sent" | "error";

function LoginCard() {
  const params = useSearchParams();
  const [email, setEmail] = React.useState("");
  const [status, setStatus] = React.useState<Status>("idle");
  const [message, setMessage] = React.useState<string | null>(null);

  // Surface the callback's allow-list rejection (?error=not_allowed) and other
  // recoverable callback errors as a friendly banner.
  const callbackError = params.get("error");
  const banner =
    callbackError === "not_allowed"
      ? "이 이메일은 접근 권한이 없습니다. 소유자 계정으로만 로그인할 수 있습니다."
      : callbackError === "auth_failed"
        ? "로그인 링크가 만료되었거나 유효하지 않습니다. 다시 시도해 주세요."
        : null;

  const handleSubmit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = email.trim();
      if (!trimmed) return;

      setStatus("sending");
      setMessage(null);

      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: {
          // Where the magic link lands; the callback route exchanges the code.
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setStatus("error");
        setMessage(error.message);
        return;
      }
      setStatus("sent");
    },
    [email],
  );

  return (
    <div className="w-full max-w-sm">
      <div className="rounded-[var(--radius)] border border-border bg-card p-6 shadow-md sm:p-8">
        {/* Brand */}
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Mail size={22} />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            PaneBoard
          </h1>
          <p className="text-sm text-muted-foreground">
            이메일로 로그인 링크를 보내드립니다.
          </p>
        </div>

        {banner ? (
          <div
            role="alert"
            className="mb-4 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          >
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{banner}</span>
          </div>
        ) : null}

        {status === "sent" ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CheckCircle2 size={36} className="text-primary" />
            <p className="text-sm font-medium text-foreground">
              메일함을 확인하세요
            </p>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{email}</span> 주소로
              로그인 링크를 보냈습니다. 링크를 누르면 자동으로 로그인됩니다.
            </p>
            <button
              type="button"
              onClick={() => {
                setStatus("idle");
                setMessage(null);
              }}
              className="mt-1 text-xs text-primary underline-offset-2 hover:underline"
            >
              다른 이메일로 다시 시도
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label htmlFor="email" className="sr-only">
              이메일 주소
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={status === "sending"}
              className="h-11 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            />

            {status === "error" && message ? (
              <p className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertCircle size={14} className="shrink-0" />
                {message}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={status === "sending" || email.trim().length === 0}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
            >
              {status === "sending" ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  보내는 중…
                </>
              ) : (
                <>
                  <Mail size={16} />
                  로그인 링크 받기
                </>
              )}
            </button>
          </form>
        )}
      </div>

      <p className="mt-4 px-2 text-center text-xs text-muted-foreground">
        본인 전용 대시보드입니다. 등록된 소유자 이메일만 로그인할 수 있습니다.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-12">
      {/* useSearchParams requires a Suspense boundary during prerender. */}
      <React.Suspense fallback={null}>
        <LoginCard />
      </React.Suspense>
    </main>
  );
}
