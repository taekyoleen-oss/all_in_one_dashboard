/**
 * ============================================================================
 *  / — the canvas page (Server Component shell over the client canvas)
 * ============================================================================
 *
 *  This route is protected by proxy.ts (optimistic cookie gate), but the
 *  authoritative auth check lives here, close to the data: we read the verified
 *  session server-side via lib/supabase/server.ts and enforce the **관리자 승인
 *  허용목록**(관리자 = ALLOWED_EMAIL, 그 외 pb_members.approved). 세션이 없으면
 *  /login으로, 세션은 있으나 미승인이면 <NoAccess>(로그아웃 화면)로 — 리다이렉트
 *  루프를 피하려면 후자는 튕기지 말아야 한다(proxy.ts 주석 참고).
 *  로그인 이메일은 <CanvasShell>의 계정 메뉴로, 관리자 여부는 설정 > 멤버 탭 노출에 쓰인다.
 *
 *  The interactive canvas itself lives in <CanvasShell> (Client Component) —
 *  this file stays a Server Component so it can touch HttpOnly cookies. DB
 *  persistence (NEXT chunk) plugs into the same server client (auth.uid()).
 * ============================================================================
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CanvasShell } from "@/components/canvas/CanvasShell";
import { NoAccess } from "@/components/canvas/NoAccess";
import { loadUserBoards } from "@/lib/supabase/queries/boards";
import { isAllowedEmail, isOwnerEmail } from "@/lib/auth/members";

export default async function Home() {
  const supabase = await createClient();

  // getClaims() verifies the JWT (asymmetric signing keys) rather than trusting
  // the raw cookie — the recommended secure read on the server.
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email as string | undefined;
  // `sub` is the authenticated user id (auth.uid()); every persisted row keys off it.
  const userId = data?.claims?.sub as string | undefined;

  if (!email || !userId) redirect("/login");

  // 세션은 유효하지만 승인 목록에 없으면 캔버스 대신 안내 화면(로그아웃이 출구).
  if (!(await isAllowedEmail(email))) return <NoAccess email={email} />;

  // Load the user's boards + widgets (RLS-scoped to auth.uid()); first login
  // bootstraps a default board so the canvas is never empty.
  const initialBoards = await loadUserBoards(userId);

  return (
    <CanvasShell
      userEmail={email}
      userId={userId}
      isOwner={isOwnerEmail(email)}
      initialBoards={initialBoards}
    />
  );
}
