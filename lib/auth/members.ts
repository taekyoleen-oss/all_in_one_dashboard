/**
 * ============================================================================
 *  접근 허용 목록 — 관리자 승인제 (SERVER-ONLY)
 * ============================================================================
 *
 *  단일 사용자(ALLOWED_EMAIL 1개)에서 **소수 공유**로 넘어가기 위한 게이트.
 *
 *    • 관리자(= `ALLOWED_EMAIL`)는 DB 조회 없이 항상 통과 — 부트스트랩 보장.
 *      표가 비어 있거나 DB가 죽어도 관리자는 잠기지 않는다.
 *    • 그 외 이메일은 `pb_members.status = 'approved'` 여야 통과.
 *
 *  흐름: 사용자가 /login에서 '비밀번호 설정' → 미승인이면 pending 행만 남고
 *  **auth 계정은 만들어지지 않는다** → 관리자가 설정 > 멤버에서 승인 →
 *  사용자가 다시 '비밀번호 설정'을 누르면 그때 계정이 생성된다.
 *  (승인 알림 메일은 없다 — SMTP 없이 굴리려는 의도적 선택. 관리자가 직접 알린다.)
 *
 *  판정 규칙 자체는 lib/auth/access.ts(순수, 테스트 대상)에 있다. 이 파일은 DB 접근만.
 *
 *  이 모듈은 service-role 클라이언트를 쓰므로 서버 전용이다 — Client Component에서
 *  값 import 금지. UI는 lib/auth/actions.ts의 서버 액션을 통한다.
 * ============================================================================
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  decideAccess,
  isOwnerEmail,
  normalizeEmail,
  ownerEmail,
  type MemberRow,
  type MemberStatus,
} from "./access";

export {
  decideAccess,
  isOwnerEmail,
  normalizeEmail,
  ownerEmail,
  type MemberRow,
  type MemberStatus,
};

/** pb_members에서 status 1건 조회. 행이 없거나 오류면 null(= 미승인). */
export async function memberStatus(email: string): Promise<MemberStatus | null> {
  const e = normalizeEmail(email);
  if (e === "") return null;
  try {
    const { data, error } = await createAdminClient()
      .from("pb_members")
      .select("status")
      .eq("email", e)
      .maybeSingle();
    if (error || !data) return null;
    return data.status as MemberStatus;
  } catch {
    // 관리자는 이 함수를 타지 않으므로, 조회 실패는 '미승인'으로 닫는 게 안전하다.
    return null;
  }
}

/** 이 이메일이 앱에 들어올 수 있는가. 관리자는 DB 조회 없이 즉시 true. */
export async function isAllowedEmail(email?: string | null): Promise<boolean> {
  const e = normalizeEmail(email);
  if (e === "") return false;
  if (isOwnerEmail(e)) return true;
  return decideAccess(e, ownerEmail(), await memberStatus(e));
}

export type RequestOutcome =
  | "requested" // 새로 접수됨
  | "pending" // 이미 접수돼 승인 대기 중
  | "approved" // 이미 승인된 이메일
  | "blocked" // 차단된 이메일
  | "error";

/**
 * 접근 요청 접수 — pending 행을 남긴다. 이미 있는 행의 status는 덮지 않는다
 * (승인·차단 결정을 사용자 재요청이 되돌리면 안 된다).
 */
export async function requestAccess(
  email: string,
  note?: string,
): Promise<RequestOutcome> {
  const e = normalizeEmail(email);
  if (e === "") return "error";
  try {
    const existing = await memberStatus(e);
    if (existing === "approved") return "approved";
    if (existing === "blocked") return "blocked";
    if (existing === "pending") return "pending";

    const { error } = await createAdminClient().from("pb_members").insert({
      email: e,
      status: "pending",
      note: note?.trim() ? note.trim().slice(0, 200) : null,
    });
    if (error) return "error";
    return "requested";
  } catch {
    return "error";
  }
}

/** 관리자 화면용 — 대기 중이 먼저, 그 안에서는 오래된 요청 순. */
export async function listMembers(): Promise<MemberRow[]> {
  try {
    const { data, error } = await createAdminClient()
      .from("pb_members")
      .select("email,status,note,requested_at,decided_at")
      .order("requested_at", { ascending: true });
    if (error || !data) return [];
    const rank = (s: MemberStatus) =>
      s === "pending" ? 0 : s === "approved" ? 1 : 2;
    return [...(data as MemberRow[])].sort(
      (a, b) => rank(a.status) - rank(b.status),
    );
  } catch {
    return [];
  }
}

/** 승인/차단 전환. 차단 시엔 세션이 살아있지 않도록 auth 계정도 지운다. */
export async function setMemberStatus(
  email: string,
  status: MemberStatus,
): Promise<boolean> {
  const e = normalizeEmail(email);
  if (e === "" || isOwnerEmail(e)) return false; // 관리자 자신은 대상 아님
  try {
    const { error } = await createAdminClient()
      .from("pb_members")
      .upsert(
        { email: e, status, decided_at: new Date().toISOString() },
        { onConflict: "email" },
      );
    if (error) return false;
    if (status !== "approved") await deleteAuthUser(e);
    return true;
  } catch {
    return false;
  }
}

/** 목록에서 완전 삭제(+ 계정 삭제) — 거절/탈퇴. 다시 요청하면 pending으로 돌아온다. */
export async function removeMember(email: string): Promise<boolean> {
  const e = normalizeEmail(email);
  if (e === "" || isOwnerEmail(e)) return false;
  try {
    const { error } = await createAdminClient()
      .from("pb_members")
      .delete()
      .eq("email", e);
    if (error) return false;
    await deleteAuthUser(e);
    return true;
  } catch {
    return false;
  }
}

/**
 * auth.users 행 삭제 — 이게 있어야 **이미 발급된 세션이 즉시 죽는다**.
 * (요금 유발 라우트의 requireUser()는 세션 유무만 보므로, 권한을 뺏을 땐
 *  허용목록만 고치는 걸로는 부족하다. 그 사용자의 pb_* 데이터도 FK로 함께 삭제된다.)
 */
async function deleteAuthUser(email: string): Promise<void> {
  const e = normalizeEmail(email);
  try {
    const admin = createAdminClient();
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const user = data?.users.find((u) => normalizeEmail(u.email) === e);
    if (user) await admin.auth.admin.deleteUser(user.id);
  } catch {
    /* best-effort — 목록 갱신 자체는 이미 성공했다 */
  }
}
