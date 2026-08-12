/**
 * ============================================================================
 *  GET /auth/callback — magic-link code exchange + 승인 목록 검사
 * ============================================================================
 *
 *  The magic link in the email points here with a `?code=` (PKCE) param. We:
 *    1. Exchange the code for a session (sets the auth cookies via @supabase/ssr).
 *    2. 승인 목록 검사(CLAUDE.md 가드레일): 세션 이메일이 관리자(ALLOWED_EMAIL)
 *       이거나 `pb_members.status='approved'` 여야 한다. 아니면 즉시 signOut 후
 *       /login?error=not_allowed 로 — 발판을 남기지 않는다.
 *    3. Redirect to `next` (same-origin only) or `/` on success.
 *
 *  Route Handler (Next.js 16, app dir). Uses the async SSR server client from
 *  lib/supabase/server.ts — anon key only, never the service-role key. The
 *  server client's `setAll` writes refreshed cookies into the outgoing response
 *  because route handlers have a writable cookie store (unlike RSC render).
 * ============================================================================
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/auth/members";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // Only allow same-origin relative redirects for `next` (open-redirect guard).
  const nextParam = searchParams.get("next");
  const nextPath =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/";

  // No code → the link was malformed or already consumed.
  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  // 승인 목록 검사. getClaims() verifies the freshly-set JWT.
  const { data: claimsData } = await supabase.auth.getClaims();
  const email = (claimsData?.claims?.email as string | undefined)?.toLowerCase();

  if (!(await isAllowedEmail(email))) {
    // 관리자도 승인 회원도 아님 — 방금 발급된 세션을 회수한다.
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=not_allowed`);
  }

  // If this code exchange yielded a Google provider token (i.e. the owner linked
  // Google for the calendar widget — a magic-link exchange has none), persist
  // google_connected so the calendar ConfigEditor can show "연결됨". Best-effort:
  // a failure here must not block the redirect, and the provider token itself is
  // NEVER written anywhere (only the boolean flag). RLS scopes the upsert to the
  // owner; the row is keyed by the user id.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.provider_token && session.user?.id) {
    try {
      await supabase
        .from("pb_user_settings")
        .upsert(
          { user_id: session.user.id, google_connected: true },
          { onConflict: "user_id" },
        );
    } catch {
      // Non-fatal — the widget also detects connection from the live feed.
    }
  }

  return NextResponse.redirect(`${origin}${nextPath}`);
}
