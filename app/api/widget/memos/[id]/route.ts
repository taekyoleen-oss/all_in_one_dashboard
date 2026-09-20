/**
 * /api/widget/memos/[id] — 메모 1건 수정(Bearer 디바이스 토큰).
 *
 *  PATCH : { title?, text? } — 있는 필드만. **config를 통째로 쓰지 않는다**:
 *          현재 config를 읽어 그 필드만 덮어쓴다(색·글자 크기·비밀번호 해시·
 *          자동잠금 시간 보존). 근거는 lib/api/widgetMemo.ts 머리말.
 *          POST는 PATCH의 별칭 — 안드로이드 HttpURLConnection이 PATCH를 못 보낸다.
 *
 *  잠긴 메모는 **거부**(423)한다. 폰은 잠금을 풀 방법이 없고, 본문도 받은 적이
 *  없으므로 여기서 쓰게 두면 빈 값으로 덮어쓰는 사고가 난다.
 *
 *  삭제는 두지 않았다 — 메모 한 건 = 캔버스의 위젯 하나라, 폰의 실수 한 번이
 *  웹 대시보드에서 위젯을 없애는 일이 된다. 삭제는 웹에서 한다.
 */
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireDevice } from "@/lib/api/widgetDevice";
import {
  isLockedMemo,
  memoRow,
  mergeMemoConfig,
  type MemoConfigRow,
} from "@/lib/api/widgetMemo";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" } as const;

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/widget/memos/[id]">,
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
  const { title, text } = (raw ?? {}) as { title?: unknown; text?: unknown };
  const patch: { title?: string; text?: string } = {};
  if (title !== undefined) {
    if (typeof title !== "string") {
      return Response.json(
        { error: "bad_request", message: "title은 문자열이어야 합니다." },
        { status: 400, headers: NO_STORE },
      );
    }
    patch.title = title.trim().slice(0, 200);
  }
  if (text !== undefined) {
    if (typeof text !== "string") {
      return Response.json(
        { error: "bad_request", message: "text는 문자열이어야 합니다." },
        { status: 400, headers: NO_STORE },
      );
    }
    patch.text = text.slice(0, 20_000);
  }
  if (Object.keys(patch).length === 0) {
    return Response.json(
      { error: "bad_request", message: "수정할 필드가 없습니다." },
      { status: 400, headers: NO_STORE },
    );
  }

  const { id } = await ctx.params;
  const admin = createAdminClient();

  // 읽고(소유·타입·잠금 확인) → 병합 → 쓴다. user_id 스코프라 타인 id는 404.
  const { data: rows, error: readErr } = await admin
    .from("pb_widgets")
    .select("id, config")
    .eq("id", id)
    .eq("user_id", device.userId)
    .eq("type", "memo");
  if (readErr) {
    return Response.json(
      { error: "upstream", message: "메모 조회에 실패했습니다." },
      { status: 502, headers: NO_STORE },
    );
  }
  if (!rows?.length) {
    return Response.json(
      { error: "not_found", message: "메모를 찾을 수 없습니다." },
      { status: 404, headers: NO_STORE },
    );
  }

  const current = rows[0].config as MemoConfigRow;
  if (isLockedMemo(current)) {
    return Response.json(
      {
        error: "locked",
        message: "비밀번호가 걸린 메모입니다. 웹에서 잠금을 푼 뒤 수정해 주세요.",
      },
      { status: 423, headers: NO_STORE },
    );
  }

  const { data, error } = await admin
    .from("pb_widgets")
    .update({ config: mergeMemoConfig(current, patch) })
    .eq("id", id)
    .eq("user_id", device.userId)
    .select("id, config, updated_at");
  if (error || !data?.length) {
    return Response.json(
      { error: "upstream", message: "저장에 실패했습니다." },
      { status: 502, headers: NO_STORE },
    );
  }

  const row = data[0];
  return Response.json(
    memoRow(row.id, row.config as MemoConfigRow, row.updated_at),
    { headers: NO_STORE },
  );
}

export const POST = PATCH;
