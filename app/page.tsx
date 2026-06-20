/**
 * ============================================================================
 *  / — the canvas page (Server Component shell over the client canvas)
 * ============================================================================
 *
 *  This route is protected by proxy.ts (optimistic cookie gate), but the
 *  authoritative auth check lives here, close to the data: we read the verified
 *  session server-side via lib/supabase/server.ts and enforce the single-user
 *  allow-list (ALLOWED_EMAIL). A missing/foreign session is redirected to
 *  /login. The owner's email is passed to <CanvasShell> for the account menu.
 *
 *  The interactive canvas itself lives in <CanvasShell> (Client Component) —
 *  this file stays a Server Component so it can touch HttpOnly cookies. DB
 *  persistence (NEXT chunk) plugs into the same server client (auth.uid()).
 * ============================================================================
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CanvasShell } from "@/components/canvas/CanvasShell";
import { loadUserBoards } from "@/lib/supabase/queries/boards";

export default async function Home() {
  const supabase = await createClient();

  // getClaims() verifies the JWT (asymmetric signing keys) rather than trusting
  // the raw cookie — the recommended secure read on the server.
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email as string | undefined;
  // `sub` is the authenticated user id (auth.uid()); every persisted row keys off it.
  const userId = data?.claims?.sub as string | undefined;
  const allowed = process.env.ALLOWED_EMAIL?.toLowerCase();

  if (!email || !userId || !allowed || email.toLowerCase() !== allowed) {
    redirect("/login");
  }

  // Load the user's boards + widgets (RLS-scoped to auth.uid()); first login
  // bootstraps a default board so the canvas is never empty.
  const initialBoards = await loadUserBoards(userId);

  return (
    <CanvasShell
      userEmail={email}
      userId={userId}
      initialBoards={initialBoards}
    />
  );
}
