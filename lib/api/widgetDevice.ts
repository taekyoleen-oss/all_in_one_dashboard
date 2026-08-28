/**
 * 디바이스 토큰 인증 게이트 (SERVER-ONLY) — /api/widget/agenda·appointments 공용.
 *
 *  웹 세션(requireUser) 대신 Bearer 디바이스 토큰을 검증한다: sha256(토큰)을
 *  pb_widget_devices.token_hash와 대조하고 revoked_at이 null인 행만 통과.
 *  통과 시 last_seen_at을 갱신한다(설정 UI의 '마지막 사용' 표시용).
 *
 *  service-role 사용 근거(lib/supabase/admin.ts의 허용 목록과 같은 부류):
 *  쿠키 세션이 없는 경로라 anon 클라이언트로는 불가하고, user_id는 항상 토큰으로
 *  서버에서 해석한 값만 쓴다 — cards/ingest의 per-user 토큰 패턴과 동일.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimited, sha256Hex } from "@/lib/api/widgetCore";

const NO_STORE = { "cache-control": "no-store" } as const;

export interface WidgetDeviceAuth {
  userId: string;
  deviceId: string;
}

/** Bearer 토큰을 검증해 소유자를 해석한다. 실패 시 그대로 반환할 Response. */
export async function requireDevice(
  request: Request,
): Promise<WidgetDeviceAuth | Response> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) {
    return Response.json(
      { error: "unauthorized", message: "디바이스 토큰이 필요합니다." },
      { status: 401, headers: NO_STORE },
    );
  }

  const hash = sha256Hex(token);
  // 계획서: 동일 토큰 분당 20회. 무효 토큰도 같은 키로 세어 무차별 대입을 함께 늦춘다.
  if (rateLimited(`wdev:${hash}`)) {
    return Response.json(
      { error: "rate_limited", message: "요청이 너무 잦습니다. 잠시 후 다시 시도하세요." },
      { status: 429, headers: NO_STORE },
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("pb_widget_devices")
    .select("id, user_id")
    .eq("token_hash", hash)
    .is("revoked_at", null)
    .maybeSingle();

  if (error) {
    return Response.json(
      { error: "upstream", message: "인증 확인에 실패했습니다." },
      { status: 502, headers: NO_STORE },
    );
  }
  if (!data) {
    return Response.json(
      { error: "unauthorized", message: "등록되지 않았거나 폐기된 디바이스입니다." },
      { status: 401, headers: NO_STORE },
    );
  }

  await admin
    .from("pb_widget_devices")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", data.id);

  return { userId: data.user_id, deviceId: data.id };
}
