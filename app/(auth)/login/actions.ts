"use server";

/**
 * ============================================================================
 *  Login server actions — owner password provisioning
 * ============================================================================
 *
 *  PaneBoard uses email + password sign-in (more reliable than magic links: no
 *  email round-trip, no Gmail link pre-scan, no PKCE-verifier-across-redirect).
 *
 *  `setOwnerPassword` lets the single owner set (or reset) their password the
 *  first time — gated to `ALLOWED_EMAIL` so ONLY the owner account can be
 *  provisioned this way. It runs server-side with the service-role admin client
 *  (which works before any session exists). The service-role key never reaches
 *  the client. Returns a plain result; never throws to the caller.
 * ============================================================================
 */

import { createAdminClient } from "@/lib/supabase/admin";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function setOwnerPassword(
  email: string,
  password: string,
): Promise<ActionResult> {
  const allowed = process.env.ALLOWED_EMAIL?.trim().toLowerCase();
  const target = email.trim().toLowerCase();

  if (!allowed) {
    return { ok: false, error: "서버에 ALLOWED_EMAIL이 설정되지 않았습니다." };
  }
  if (target !== allowed) {
    return { ok: false, error: "등록된 소유자 이메일만 사용할 수 있습니다." };
  }
  if (password.length < 6) {
    return { ok: false, error: "비밀번호는 6자 이상이어야 합니다." };
  }

  try {
    const admin = createAdminClient();
    // Single-user app: the owner is on the first page of users (if they exist).
    const { data, error } = await admin.auth.admin.listUsers();
    if (error) return { ok: false, error: error.message };

    const existing = data.users.find(
      (u) => u.email?.toLowerCase() === allowed,
    );

    if (existing) {
      const { error: updErr } = await admin.auth.admin.updateUserById(
        existing.id,
        { password },
      );
      if (updErr) return { ok: false, error: updErr.message };
    } else {
      const { error: createErr } = await admin.auth.admin.createUser({
        email: allowed,
        password,
        email_confirm: true, // owner is trusted; no email verification step
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
