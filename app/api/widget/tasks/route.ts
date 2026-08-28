/**
 * /api/widget/tasks — 모바일 홈 화면 '작업' 위젯의 목록·추가(Bearer 디바이스 토큰).
 *
 *  GET  : 지정된 웹 '작업' 위젯 인스턴스(config.mobileSync, 최신 mobileSyncAt)의
 *         작업 목록. 지정 없음 → { instanceId: null, items: [] } (위젯이 안내 표시).
 *         ETag/304 지원(아젠다와 동일 — 15분 폴링 비용 절감).
 *  POST : { title } 로 그 인스턴스에 작업 1건 추가 → 추가된 행 반환.
 *         웹 위젯은 pb_tasks realtime 구독으로 즉시 반영된다.
 */
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireDevice } from "@/lib/api/widgetDevice";
import { pickTasksInstance, sha256Hex } from "@/lib/api/widgetCore";
import type { WidgetTask } from "@/output/api-shapes";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" } as const;

type Admin = ReturnType<typeof createAdminClient>;

/** 모바일 표시로 지정된 '작업' 위젯 인스턴스 id — 없으면 null. */
async function resolveInstance(admin: Admin, userId: string): Promise<string | null> {
  const { data, error } = await admin
    .from("pb_widgets")
    .select("id, config")
    .eq("user_id", userId)
    .eq("type", "tasks");
  if (error) throw new Error(error.message);
  return pickTasksInstance(data ?? []);
}

export async function GET(request: NextRequest) {
  const device = await requireDevice(request);
  if (device instanceof Response) return device;

  const admin = createAdminClient();
  let instanceId: string | null;
  try {
    instanceId = await resolveInstance(admin, device.userId);
  } catch {
    return Response.json(
      { error: "upstream", message: "작업 위젯 조회에 실패했습니다." },
      { status: 502, headers: NO_STORE },
    );
  }

  let items: WidgetTask[] = [];
  if (instanceId) {
    const { data, error } = await admin
      .from("pb_tasks")
      .select("id, title, done, due_on, created_at")
      .eq("user_id", device.userId)
      .eq("instance_id", instanceId)
      .order("created_at", { ascending: true });
    if (error) {
      return Response.json(
        { error: "upstream", message: "작업 조회에 실패했습니다." },
        { status: 502, headers: NO_STORE },
      );
    }
    items = (data ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      done: r.done,
      dueOn: r.due_on,
      createdAt: r.created_at,
    }));
  }

  const body = { instanceId, items };
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
  const { title, dueOn } = (raw ?? {}) as { title?: unknown; dueOn?: unknown };
  const clean = typeof title === "string" ? title.trim().slice(0, 500) : "";
  if (!clean) {
    return Response.json(
      { error: "bad_request", message: "작업 내용을 입력해 주세요." },
      { status: 400, headers: NO_STORE },
    );
  }
  const cleanDue =
    typeof dueOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dueOn) ? dueOn : null;

  const admin = createAdminClient();
  let instanceId: string | null;
  try {
    instanceId = await resolveInstance(admin, device.userId);
  } catch {
    instanceId = null;
  }
  if (!instanceId) {
    return Response.json(
      {
        error: "no_target",
        message: "웹 대시보드의 '작업' 위젯 속성에서 '모바일 홈 화면에 표시'를 먼저 켜 주세요.",
      },
      { status: 409, headers: NO_STORE },
    );
  }

  const { data, error } = await admin
    .from("pb_tasks")
    .insert({
      user_id: device.userId,
      instance_id: instanceId,
      title: clean,
      due_on: cleanDue,
    })
    .select("id, title, done, due_on, created_at")
    .single();
  if (error || !data) {
    return Response.json(
      { error: "upstream", message: "추가에 실패했습니다. 다시 시도해 주세요." },
      { status: 502, headers: NO_STORE },
    );
  }
  return Response.json(
    {
      id: data.id,
      title: data.title,
      done: data.done,
      dueOn: data.due_on,
      createdAt: data.created_at,
    },
    { status: 201, headers: NO_STORE },
  );
}
