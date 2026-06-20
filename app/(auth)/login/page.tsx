"use client";

/**
 * ============================================================================
 *  /login — email + password sign-in (설계서 §3.1, §3.3; replaces magic link)
 * ============================================================================
 *
 *  Single-user app: only `ALLOWED_EMAIL` may sign in (enforced server-side at
 *  proxy.ts + app/page.tsx, and again by `setOwnerPassword`). Email + password is
 *  used instead of magic links — it's far more reliable (no email round-trip, no
 *  Gmail link pre-scan, no PKCE verifier surviving a redirect).
 *
 *  Two modes:
 *   • "login"  — `signInWithPassword`. Session is set on the browser client →
 *                cookies → the server (proxy/page) reads it → we route to `/`.
 *   • "setup"  — first time (or reset): calls the `setOwnerPassword` server action
 *                (admin, ALLOWED_EMAIL-gated) to set the password, then signs in.
 * ============================================================================
 */

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { setOwnerPassword } from "./actions";
import { Lock, Loader2, AlertCircle, LogIn, KeyRound } from "lucide-react";

type Mode = "login" | "setup";
type Status = "idle" | "working" | "error";

function LoginCard() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = React.useState<Mode>("login");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [status, setStatus] = React.useState<Status>("idle");
  const [message, setMessage] = React.useState<string | null>(null);

  const callbackError = params.get("error");
  const banner =
    callbackError === "not_allowed"
      ? "이 이메일은 접근 권한이 없습니다. 소유자 계정으로만 로그인할 수 있습니다."
      : null;

  const signIn = React.useCallback(
    async (em: string, pw: string) => {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: em,
        password: pw,
      });
      if (error) {
        setStatus("error");
        setMessage(
          /invalid/i.test(error.message)
            ? "이메일 또는 비밀번호가 올바르지 않습니다. 처음이시면 아래 ‘비밀번호 설정’을 누르세요."
            : error.message,
        );
        return false;
      }
      // Session set on the browser client (cookies) → enter the app.
      router.replace("/");
      router.refresh();
      return true;
    },
    [router],
  );

  const handleSubmit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const em = email.trim();
      const pw = password;
      if (!em || !pw) return;
      setStatus("working");
      setMessage(null);

      if (mode === "setup") {
        const res = await setOwnerPassword(em, pw);
        if (!res.ok) {
          setStatus("error");
          setMessage(res.error);
          return;
        }
      }
      await signIn(em, pw);
    },
    [email, password, mode, signIn],
  );

  const working = status === "working";

  return (
    <div className="w-full max-w-sm">
      <div className="rounded-[var(--radius)] border border-border bg-card p-6 shadow-md sm:p-8">
        {/* Brand */}
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Lock size={22} />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            PaneBoard
          </h1>
          <p className="text-sm text-muted-foreground">
            {mode === "login"
              ? "이메일과 비밀번호로 로그인하세요."
              : "최초 1회 비밀번호를 설정합니다."}
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

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-xs text-muted-foreground">
              이메일 (아이디)
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={working}
              className="h-11 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-xs text-muted-foreground">
              비밀번호 {mode === "setup" ? "(6자 이상)" : ""}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === "setup" ? "new-password" : "current-password"}
              required
              minLength={6}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={working}
              className="h-11 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            />
          </div>

          {status === "error" && message ? (
            <p className="flex items-start gap-1.5 text-xs text-destructive">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{message}</span>
            </p>
          ) : null}

          <button
            type="submit"
            disabled={working || !email.trim() || password.length === 0}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            {working ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                처리 중…
              </>
            ) : mode === "login" ? (
              <>
                <LogIn size={16} />
                로그인
              </>
            ) : (
              <>
                <KeyRound size={16} />
                비밀번호 설정하고 로그인
              </>
            )}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => {
              setMode((m) => (m === "login" ? "setup" : "login"));
              setStatus("idle");
              setMessage(null);
            }}
            className="text-xs text-primary underline-offset-2 hover:underline"
          >
            {mode === "login"
              ? "처음이신가요? 비밀번호 설정 / 재설정"
              : "← 로그인으로 돌아가기"}
          </button>
        </div>
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
