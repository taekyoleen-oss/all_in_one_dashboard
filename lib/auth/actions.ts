"use server";

/**
 * 멤버 관리 서버 액션 — 관리자(ALLOWED_EMAIL) 전용.
 *
 *  UI(SettingsDialog 멤버 탭)는 Client Component라 service-role 클라이언트를 직접
 *  쓸 수 없다. 이 파일이 그 경계다. **모든 액션은 호출자를 서버에서 다시 확인한다** —
 *  클라이언트가 넘긴 "나 관리자야"는 절대 믿지 않는다.
 */

import { createClient } from "@/lib/supabase/server";
import {
  isOwnerEmail,
  listMembers,
  removeMember,
  setMemberStatus,
  type MemberRow,
} from "./members";

/** 검증된 세션의 이메일이 관리자인가. */
async function callerIsOwner(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return isOwnerEmail(data?.claims?.email as string | undefined);
}

export async function listMembersAction(): Promise<MemberRow[]> {
  if (!(await callerIsOwner())) return [];
  return listMembers();
}

export async function approveMemberAction(email: string): Promise<boolean> {
  if (!(await callerIsOwner())) return false;
  return setMemberStatus(email, "approved");
}

export async function blockMemberAction(email: string): Promise<boolean> {
  if (!(await callerIsOwner())) return false;
  return setMemberStatus(email, "blocked");
}

export async function removeMemberAction(email: string): Promise<boolean> {
  if (!(await callerIsOwner())) return false;
  return removeMember(email);
}
