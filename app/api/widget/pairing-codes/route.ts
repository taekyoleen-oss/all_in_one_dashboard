/**
 * POST /api/widget/pairing-codes — 위젯 페어링 코드 발급(웹 세션 전용).
 *
 *  로그인한 사용자가 설정 > 위젯에서 누르면 6자리 1회용 코드를 만든다(5분 만료).
 *  서버는 sha256 해시만 pb_widget_pairing_codes에 저장한다(정책 없음 = service-role
 *  전용 테이블). 1인 1코드 — 발급 시 이전 코드를 지워 최신 코드만 유효하다.
 */
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { newPairingCode, PAIRING_TTL_MS, sha256Hex } from "@/lib/api/widgetCore";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" } as const;

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return Response.json(
      { error: "unauthorized", message: "로그인이 필요합니다." },
      { status: 401, headers: NO_STORE },
    );
  }

  const admin = createAdminClient();
  const code = newPairingCode();
  const expiresAt = new Date(Date.now() + PAIRING_TTL_MS).toISOString();

  // 1인 1코드: 이전(미사용·만료 포함) 코드를 정리하고 새 코드만 남긴다.
  await admin.from("pb_widget_pairing_codes").delete().eq("user_id", user.id);
  const { error } = await admin.from("pb_widget_pairing_codes").insert({
    code_hash: sha256Hex(code),
    user_id: user.id,
    expires_at: expiresAt,
  });
  if (error) {
    return Response.json(
      { error: "upstream", message: "코드 발급에 실패했습니다. 다시 시도해 주세요." },
      { status: 502, headers: NO_STORE },
    );
  }

  return Response.json({ code, expiresAt }, { headers: NO_STORE });
}
