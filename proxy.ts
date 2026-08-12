/**
 * ============================================================================
 *  proxy.ts — Next.js 16 Proxy (the renamed Middleware) — auth gate + session
 *             refresh (설계서 §3.3, CLAUDE.md 본인 전용 가드레일)
 * ============================================================================
 *
 *  ⚠ Next.js 16 renamed Middleware → "Proxy" (node_modules/.../16-proxy.md).
 *    Convention: a single `proxy.ts` at the project root exporting a `proxy`
 *    function (default or named) + a `config.matcher`. Same runtime behavior as
 *    the old middleware; only the file name + function name changed.
 *
 *  Responsibilities:
 *    1. **Session refresh** — runs the standard @supabase/ssr request/response
 *       cookie dance so Supabase can rotate the access/refresh tokens on every
 *       request and the user stays logged in. `getClaims()` is what actually
 *       triggers the refresh (it reads + revalidates the JWT). We MUST return
 *       the same `response` object whose cookies were mutated.
 *    2. **Route protection** — protected paths (`/`, `/settings`) require a valid
 *       session; otherwise redirect to `/login`. `/login`, `/auth/callback`, and
 *       `/api/*` are always allowed (ingest is per-user token auth, not session).
 *  Note: this is an OPTIMISTIC cookie-level check (per the Next docs, proxy runs
 *  on every request incl. prefetches — keep it to cookie/JWT reads, no DB). The
 *  authoritative auth check still lives server-side via lib/supabase/server.ts.
 *
 *  ⚠ 승인 목록(pb_members)은 **여기서 보지 않는다** — DB 조회가 필요해 proxy의
 *  "no DB" 규칙에 어긋나고, 미승인 세션을 /login으로 튕기면 (proxy가 로그인된
 *  사용자를 다시 /로 보내므로) 리다이렉트 루프가 된다. 승인 검사는 app/page.tsx·
 *  /auth/callback·/share가 담당하고, 미승인 세션에는 page.tsx가 '권한 없음' 화면을
 *  보여준다(로그아웃이 유일한 출구).
 * ============================================================================
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/** Exact paths (or prefixes) that require an authenticated owner session. */
// `/share` (mobile Web-Share-Target landing) is gated too: an unauthenticated
// share bounces to /login with `next=/share?…`, so the shared content survives
// the login round-trip and is processed once the owner session is established.
const PROTECTED_PREFIXES = ["/settings", "/share"];

function isProtected(pathname: string): boolean {
  if (pathname === "/") return true;
  return PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export async function proxy(request: NextRequest) {
  // The response we'll return; @supabase/ssr writes refreshed cookies into it.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Mirror the cookies onto BOTH the request (so a downstream read in
          // this same pass sees them) and a fresh response (so they reach the
          // browser). This is the canonical supabase-ssr middleware pattern.
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // IMPORTANT: do not run any logic between client creation and getClaims() —
  // it both refreshes the session and gives us the verified email for the gate.
  const { data } = await supabase.auth.getClaims();
  const email = (data?.claims?.email as string | undefined)?.toLowerCase();

  // 세션 유무만 본다(승인 여부는 page/callback/share에서 — 위 주석 참고).
  const isAuthed = Boolean(email);

  const { pathname } = request.nextUrl;

  // Unauthenticated access to a protected route → bounce to /login (preserve
  // the intended destination in `next` so the callback can return there).
  if (!isAuthed && isProtected(pathname)) {
    const loginUrl = new URL("/login", request.url);
    const dest = pathname + request.nextUrl.search;
    if (dest && dest !== "/") loginUrl.searchParams.set("next", dest);
    return NextResponse.redirect(loginUrl);
  }

  // Already authed but sitting on /login → send them into the app.
  if (isAuthed && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  // Run on everything EXCEPT static assets and image optimization. Auth routes
  // (/login, /auth/callback) and /api are matched too but explicitly allowed in
  // the handler — they still need session-cookie refresh to pass through.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
