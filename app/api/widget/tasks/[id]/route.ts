/**
 * /api/widget/tasks/[id] — 작업 1건 완료 토글·삭제(Bearer 디바이스 토큰).
 *
 *  PATCH  : { done: boolean } — 완료/해제. POST는 PATCH의 별칭 —
 *           안드로이드 HttpURLConnection이 PATCH 메서드를 못 보내는 자바 한계 우회.
 *  DELETE : 행 삭제(웹 위젯은 realtime으로 즉시 반영).
 *  갱신·삭제는 항상 토큰으로 해석한 user_id로 스코프 — 타인 id는 404.
 */
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireDevice } from "@/lib/api/widgetDevice";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" } as const;

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/widget/tasks/[id]">,
) {
  const device = await requireDevice(request);
  if (device instanceof Response) return device;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json(
      { error: "bad_request", message: "요청 형식이 올바르지 않습니다." },
      { status: 400, headers: NO_STORE },
    );
  }
  const done = (raw as { done?: unknown })?.done;
  if (typeof done !== "boolean") {
    return Response.json(
      { error: "bad_request", message: "done은 boolean이어야 합니다." },
      { status: 400, headers: NO_STORE },
    );
  }

  const { id } = await ctx.params;
  const { data, error } = await createAdminClient()
    .from("pb_tasks")
    .update({ done })
    .eq("id", id)
    .eq("user_id", device.userId)
    .select("id");
  if (error) {
    return Response.json(
      { error: "upstream", message: "변경에 실패했습니다." },
      { status: 502, headers: NO_STORE },
    );
  }
  if (!data?.length) {
    return Response.json(
      { error: "not_found", message: "작업을 찾을 수 없습니다." },
      { status: 404, headers: NO_STORE },
    );
  }
  return Response.json({ id, done }, { headers: NO_STORE });
}

export const POST = PATCH;

export async function DELETE(
  request: NextRequest,
  ctx: RouteContext<"/api/widget/tasks/[id]">,
) {
  const device = await requireDevice(request);
  if (device instanceof Response) return device;

  const { id } = await ctx.params;
  const { data, error } = await createAdminClient()
    .from("pb_tasks")
    .delete()
    .eq("id", id)
    .eq("user_id", device.userId)
    .select("id");
  if (error) {
    return Response.json(
      { error: "upstream", message: "삭제에 실패했습니다." },
      { status: 502, headers: NO_STORE },
    );
  }
  if (!data?.length) {
    return Response.json(
      { error: "not_found", message: "작업을 찾을 수 없습니다." },
      { status: 404, headers: NO_STORE },
    );
  }
  return Response.json({ id, deleted: true }, { headers: NO_STORE });
}
