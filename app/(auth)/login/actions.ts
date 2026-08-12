"use server";

/**
 * ============================================================================
 *  Login server actions — 계정 비밀번호 설정 + 접근 요청 접수
 * ============================================================================
 *
 *  PaneBoard uses email + password sign-in (more reliable than magic links: no
 *  email round-trip, no Gmail link pre-scan, no PKCE-verifier-across-redirect).
 *
 *  `setAccountPassword`는 **허용된 이메일**(관리자 = ALLOWED_EMAIL, 또는
 *  pb_members.status='approved')에 대해서만 계정을 만들거나 비밀번호를 재설정한다.
 *  허용되지 않은 이메일이면 계정을 만들지 않고 **접근 요청만 접수**(pending)하고
 *  안내를 돌려준다 → 관리자가 설정 > 멤버에서 승인 → 사용자가 다시 눌러 계정 생성.
 *
 *  이 흐름 덕분에 SMTP(인증 메일)가 필요 없고, 미승인자의 auth 계정도 생기지 않는다.
 *  service-role admin 클라이언트로 동작하며(세션 전에 실행돼야 하므로), 키는 클라이언트에
 *  절대 도달하지 않는다. 항상 평문 결과를 반환하고 예외를 던지지 않는다.
 * ============================================================================
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  isAllowedEmail,
  normalizeEmail,
  ownerEmail,
  requestAccess,
} from "@/lib/auth/members";

export type ActionResult =
  | { ok: true }
  /** pending=true는 실패가 아니라 '요청 접수됨' 안내(빨간 오류로 표시하지 않는다). */
  | { ok: false; error: string; pending?: boolean };

export async function setAccountPassword(
  email: string,
  password: string,
): Promise<ActionResult> {
  const target = normalizeEmail(email);

  if (!ownerEmail()) {
    return { ok: false, error: "서버에 ALLOWED_EMAIL(관리자 이메일)이 설정되지 않았습니다." };
  }
  if (!target) return { ok: false, error: "이메일을 입력하세요." };
  if (password.length < 6) {
    return { ok: false, error: "비밀번호는 6자 이상이어야 합니다." };
  }

  // 미승인 이메일 → 계정을 만들지 않고 요청만 접수한다.
  if (!(await isAllowedEmail(target))) {
    const outcome = await requestAccess(target);
    if (outcome === "blocked") {
      return { ok: false, error: "이 이메일은 접근이 차단되었습니다." };
    }
    if (outcome === "error") {
      return { ok: false, error: "접근 요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
    }
    return {
      ok: false,
      pending: true,
      error:
        outcome === "pending"
          ? "이미 접수된 요청입니다. 관리자 승인 후 이 화면에서 다시 '비밀번호 설정'을 눌러 주세요."
          : "접근 요청이 접수되었습니다. 관리자 승인 후 이 화면에서 다시 '비밀번호 설정'을 눌러 주세요.",
    };
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (error) return { ok: false, error: error.message };

    const existing = data.users.find(
      (u) => normalizeEmail(u.email) === target,
    );

    if (existing) {
      const { error: updErr } = await admin.auth.admin.updateUserById(
        existing.id,
        { password },
      );
      if (updErr) return { ok: false, error: updErr.message };
    } else {
      const { error: createErr } = await admin.auth.admin.createUser({
        email: target,
        password,
        email_confirm: true, // 관리자 승인이 곧 검증 — 메일 왕복 없음
      });
      if (createErr) return { ok: false, error: createErr.message };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "비밀번호 설정 중 오류가 발생했습니다.",
    };
  }
}
