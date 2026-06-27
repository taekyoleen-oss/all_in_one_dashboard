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
 *    3. **Defense-in-depth allow-list** — a session whose email ≠ ALLOWED_EMAIL
 *       is treated as unauthenticated (the callback already enforces this; here
 *       it's a backstop in case a stale/foreign cookie shows up).
 *
 *  Note: this is an OPTIMISTIC cookie-level check (per the Next docs, proxy runs
 *  on every request incl. prefetches — keep it to cookie/JWT reads, no DB). The
 *  authoritative auth check still lives server-side via lib/supabase/server.ts.
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
  const allowed = process.env.ALLOWED_EMAIL?.toLowerCase();
  const email = (data?.claims?.email as string | undefined)?.toLowerCase();

  // Treat a foreign/missing session as unauthenticated (defense-in-depth).
  const isAuthed = Boolean(allowed && email && email === allowed);

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
