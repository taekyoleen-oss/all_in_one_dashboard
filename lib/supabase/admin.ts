/**
 * ============================================================================
 *  Supabase **service-role** client — SERVER-ONLY, RLS-BYPASSING (설계서 §5.3, §6.4)
 * ============================================================================
 *
 *  ⚠ DANGER: this client authenticates with `SUPABASE_SERVICE_ROLE_KEY`, which
 *  **bypasses Row-Level Security entirely**. It has no end-user session and is
 *  NOT cookie-aware. Because RLS is off, it can read/write ANY user's rows — so
 *  every write MUST be scoped by an explicit, server-resolved `user_id`. Never
 *  derive that id from untrusted request input without first resolving it
 *  server-side (e.g. matching a per-user ingest token in `pb_user_settings`).
 *
 *  Allowed callers (둘 다 "세션 이전/무관"이라 anon 클라이언트로 불가능한 경우):
 *    1. `app/api/cards/ingest/route.ts` — per-user secret token 인증(쿠키 없음).
 *       토큰으로 소유 `user_id`를 서버에서 해석한 뒤 그 사용자 행만 쓴다.
 *    2. `lib/auth/members.ts` (+ `app/(auth)/login/actions.ts`) — 접근 허용 목록.
 *       승인 판정과 계정 생성은 세션이 **생기기 전에** 일어나고, `pb_members`는
 *       RLS 정책이 없어(deny-by-default) 오직 이 경로로만 접근한다. 쓰기 대상은
 *       항상 서버가 정규화한 이메일이며, 관리자 여부는 검증된 JWT로 재확인한다.
 *
 *  This module is server-only by convention (mirrors lib/api/*Client.ts): the
 *  service-role key is a non-`NEXT_PUBLIC_` env var and is never inlined into the
 *  client bundle, so on the client `SUPABASE_SERVICE_ROLE_KEY` is `undefined` and
 *  `createAdminClient()` throws. It must NEVER be imported into a Client
 *  Component. The session is disabled (no token refresh, no cookie persistence)
 *  because there is no user session on this path.
 * ============================================================================
 */
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Build a fresh service-role client. Returns a new instance per call (cheap; no
 * cookie/session state to share) so route invocations stay isolated.
 *
 * Throws if the service-role key is missing — a misconfigured deploy must fail
 * loudly here rather than silently fall back to an unauthenticated client.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: {
      // No end-user session on the ingest path: don't persist or refresh tokens.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export default createAdminClient;
