/**
 * Supabase **browser** client (Client Components only).
 *
 * Uses @supabase/ssr `createBrowserClient`, which is cookie-aware and safe to
 * call repeatedly on the client (it memoizes a singleton internally). Typed with
 * the generated `Database` so `.from('pb_widgets')` etc. are fully type-checked.
 *
 * Only the public anon key + URL are used here — never the service-role key.
 * (NEXT_PUBLIC_* vars are the only ones inlined into the client bundle by Next.)
 */
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
