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
 *  Allowed caller: ONLY `app/api/cards/ingest/route.ts`. The ingest endpoint is
 *  authenticated by a per-user secret token (not a session cookie), so it cannot
 *  use the anon/SSR client's `auth.uid()` — it resolves the owning `user_id` from
 *  the token, then writes that user's transaction with this client.
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
