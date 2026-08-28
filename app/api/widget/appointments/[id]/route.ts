/**
 * PATCH /api/widget/appointments/[id] — 위젯에서의 상태 변경(Bearer 디바이스 토큰).
 *
 *  요청: { status: "done" | "snoozed" | "pending", snoozeUntil?: ISO }
 *   - done    → completed_at=now, snooze_until 해제
 *   - snoozed → snooze_until = snoozeUntil 또는 기본값(다음 날 오전 9시 KST)
 *   - pending → completed_at·snooze_until 해제 (위젯 체크 해제 = 되돌리기)
 *
 *  갱신은 항상 토큰으로 해석한 user_id로 스코프한다 — 타인 일정 id를 넘겨도 0행.
 */
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireDevice } from "@/lib/api/widgetDevice";
import { nextKstMorningIso } from "@/lib/api/widgetCore";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" } as const;

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/widget/appointments/[id]">,
) {
  const device = await requireDevice(request);
  if (device instanceof Response) return device;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "bad_request", message: "요청 형식이 올바르지 않습니다." },
      { status: 400, headers: NO_STORE },
    );
  }
  const { status, snoozeUntil } = (body ?? {}) as {
    status?: unknown;
    snoozeUntil?: unknown;
  };
  if (status !== "done" && status !== "snoozed" && status !== "pending") {
    return Response.json(
      { error: "bad_request", message: "status는 done·snoozed·pending 중 하나여야 합니다." },
      { status: 400, headers: NO_STORE },
    );
  }

  const now = new Date();
  const snooze =
    status !== "snoozed"
      ? null
      : typeof snoozeUntil === "string" && !Number.isNaN(Date.parse(snoozeUntil))
        ? new Date(snoozeUntil).toISOString()
        : nextKstMorningIso(now);
  const patch = {
    status,
    completed_at: status === "done" ? now.toISOString() : null,
    snooze_until: snooze,
  };

  const { id } = await ctx.params;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("pb_circle_appointments")
    .update(patch)
    .eq("id", id)
    .eq("user_id", device.userId)
    .select("id");
  if (error) {
    return Response.json(
      { error: "upstream", message: "상태 변경에 실패했습니다." },
      { status: 502, headers: NO_STORE },
    );
  }
  if (!data?.length) {
    return Response.json(
      { error: "not_found", message: "일정을 찾을 수 없습니다." },
      { status: 404, headers: NO_STORE },
    );
  }

  return Response.json({ id, status, snoozeUntil: snooze }, { headers: NO_STORE });
}
