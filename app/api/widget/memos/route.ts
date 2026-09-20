/**
 * /api/widget/memos — 모바일 홈 화면 '메모' 위젯의 목록·추가(Bearer 디바이스 토큰).
 *
 *  GET  : 이 사용자의 웹 '메모' 위젯 **전부**를 최근 수정 순으로. 작업(tasks)처럼
 *         '모바일 표시' 지정이 없다 — 메모는 제목을 늘어놓는 것이 목적이라(요구)
 *         한 건만 고르게 하면 목록이 성립하지 않는다. ETag/304 지원.
 *  POST : { title?, text? } → **새 메모 위젯 인스턴스를 캔버스에 추가**한다.
 *         메모 한 건 = 위젯 하나이므로 '메모 추가'는 곧 위젯 추가다.
 *
 *  ⚠ 잠긴 메모(config.pwHash)는 본문을 내보내지 않는다 — api-shapes 주석 참고.
 */
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireDevice } from "@/lib/api/widgetDevice";
import { sha256Hex } from "@/lib/api/widgetCore";
import { memoRow, type MemoConfigRow } from "@/lib/api/widgetMemo";
import type { WidgetMemo } from "@/output/api-shapes";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" } as const;

/**
 * 새 메모를 놓을 보드 — 기본 보드 → 없으면 sort_order가 가장 앞선 보드.
 * (폰에는 보드 개념이 없으므로 서버가 한 곳으로 정한다.)
 */
async function targetBoard(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("pb_dashboards")
    .select("id, is_default, sort_order")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("sort_order", { ascending: true })
    .limit(1);
  return data?.[0]?.id ?? null;
}

export async function GET(request: NextRequest) {
  const device = await requireDevice(request);
  if (device instanceof Response) return device;

  const { data, error } = await createAdminClient()
    .from("pb_widgets")
    .select("id, config, updated_at")
    .eq("user_id", device.userId)
    .eq("type", "memo")
    .order("updated_at", { ascending: false });
  if (error) {
    return Response.json(
      { error: "upstream", message: "메모 조회에 실패했습니다." },
      { status: 502, headers: NO_STORE },
    );
  }

  const items: WidgetMemo[] = (data ?? []).map((r) =>
    memoRow(r.id, r.config as MemoConfigRow, r.updated_at),
  );

  const body = { items };
  const etag = `"${sha256Hex(JSON.stringify(body)).slice(0, 32)}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { etag, ...NO_STORE } });
  }
  return Response.json(body, { headers: { etag, ...NO_STORE } });
}

export async function POST(request: NextRequest) {
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
  const cleanTitle = typeof title === "string" ? title.trim().slice(0, 200) : "";
  const cleanText = typeof text === "string" ? text.slice(0, 20_000) : "";
  if (!cleanTitle && !cleanText) {
    return Response.json(
      { error: "bad_request", message: "제목이나 내용을 입력해 주세요." },
      { status: 400, headers: NO_STORE },
    );
  }

  const admin = createAdminClient();
  const boardId = await targetBoard(admin, device.userId);
  if (!boardId) {
    return Response.json(
      {
        error: "no_target",
        message: "웹 대시보드에 보드가 없습니다. 먼저 웹에서 한 번 로그인해 주세요.",
      },
      { status: 409, headers: NO_STORE },
    );
  }

  // 그 보드의 맨 아래에 놓는다(다른 위젯을 가리지 않게) — 보드 이동이 쓰는 규칙과
  // 같다. 크기는 메모 위젯의 defaultSize(components/widgets/memo/index.ts)와 동일.
  const { data: siblings } = await admin
    .from("pb_widgets")
    .select("layout")
    .eq("dashboard_id", boardId);
  const bottom = (siblings ?? []).reduce((max, w) => {
    const l = (w.layout ?? {}) as { y?: unknown; h?: unknown };
    const y = typeof l.y === "number" ? l.y : 0;
    const h = typeof l.h === "number" ? l.h : 0;
    return Math.max(max, y + h);
  }, 0);

  const { data, error } = await admin
    .from("pb_widgets")
    .insert({
      dashboard_id: boardId,
      user_id: device.userId,
      type: "memo",
      config: { title: cleanTitle, text: cleanText, color: "default", size: "md" },
      // gv:2 = 이미 2배 해상도 좌표라는 표식(읽을 때 재스케일하지 않는다).
      layout: { x: 0, y: bottom, w: 6, h: 4, gv: 2 },
    })
    .select("id, config, updated_at")
    .single();
  if (error || !data) {
    return Response.json(
      { error: "upstream", message: "메모 추가에 실패했습니다." },
      { status: 502, headers: NO_STORE },
    );
  }

  return Response.json(
    memoRow(data.id, data.config as MemoConfigRow, data.updated_at),
    { status: 201, headers: NO_STORE },
  );
}
