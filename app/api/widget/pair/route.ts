/**
 * POST /api/widget/pair — 페어링 코드 → 디바이스 토큰 교환(무세션, 코드로 검증).
 *
 *  요청: { code: "6자리", label?: "갤럭시 S24" }
 *  응답: { token, deviceId, label } — 토큰 원문은 이 응답에만 존재(DB엔 해시).
 *
 *  코드 소모는 update ... where consumed_at is null 조건부 갱신 한 방으로 처리해
 *  동시 요청이 같은 코드를 두 번 쓰지 못한다. 무세션 공개 엔드포인트라 IP당
 *  분당 10회로 제한해 6자리 코드 무차별 대입을 늦춘다(+5분 만료·1회용).
 */
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { newDeviceToken, rateLimited, sha256Hex } from "@/lib/api/widgetCore";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" } as const;

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (rateLimited(`wpair:${ip}`, 10)) {
    return Response.json(
      { error: "rate_limited", message: "요청이 너무 잦습니다. 잠시 후 다시 시도하세요." },
      { status: 429, headers: NO_STORE },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "bad_request", message: "요청 형식이 올바르지 않습니다." },
      { status: 400, headers: NO_STORE },
    );
  }
  const { code, label } = (body ?? {}) as { code?: unknown; label?: unknown };
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) {
    return Response.json(
      { error: "bad_request", message: "6자리 페어링 코드를 입력해 주세요." },
      { status: 400, headers: NO_STORE },
    );
  }

  const admin = createAdminClient();

  // 코드 검증 + 소모(원자적): 미사용·미만료 행만 consumed_at을 찍고 소유자를 얻는다.
  const { data: consumed, error: consumeErr } = await admin
    .from("pb_widget_pairing_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("code_hash", sha256Hex(code))
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("user_id");
  if (consumeErr) {
    return Response.json(
      { error: "upstream", message: "페어링 처리에 실패했습니다. 다시 시도해 주세요." },
      { status: 502, headers: NO_STORE },
    );
  }
  const owner = consumed?.[0]?.user_id;
  if (!owner) {
    return Response.json(
      { error: "invalid_code", message: "코드가 올바르지 않거나 만료되었습니다. 설정에서 새 코드를 발급해 주세요." },
      { status: 400, headers: NO_STORE },
    );
  }

  const token = newDeviceToken();
  const cleanLabel =
    typeof label === "string" && label.trim() ? label.trim().slice(0, 80) : null;
  const { data: device, error: insertErr } = await admin
    .from("pb_widget_devices")
    .insert({ user_id: owner, token_hash: sha256Hex(token), label: cleanLabel })
    .select("id")
    .single();
  if (insertErr || !device) {
    return Response.json(
      { error: "upstream", message: "디바이스 등록에 실패했습니다. 다시 시도해 주세요." },
      { status: 502, headers: NO_STORE },
    );
  }

  return Response.json(
    { token, deviceId: device.id, label: cleanLabel },
    { headers: NO_STORE },
  );
}
