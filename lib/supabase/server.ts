/**
 * Supabase **server** client (Server Components, Route Handlers, Server Actions).
 *
 * Next.js 16: `cookies()` from `next/headers` is **async** and must be awaited,
 * so this factory is async too. The @supabase/ssr cookie contract here is the
 * current `getAll` / `setAll` pair (the older single get/set/remove trio is
 * removed). `setAll` can throw when called from a Server Component render (where
 * the response is read-only); that's expected and swallowed — session refresh is
 * then handled by middleware/proxy in a later chunk.
 *
 * Server-only: this module reads HttpOnly cookies and must never be imported
 * into a Client Component.
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component — cookies are read-only here.
            // Safe to ignore; middleware/proxy refreshes the session instead.
          }
        },
      },
    },
  );
}
