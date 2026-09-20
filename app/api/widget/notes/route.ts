/**
 * /api/widget/notes — 폰 '노트' 위젯의 목록·추가(Bearer 디바이스 토큰).
 *
 *  **지정된 노트 위젯 하나**만 본다. 웹 노트 위젯 속성의 '모바일 홈 화면에 표시'를
 *  켠 인스턴스(여럿이면 마지막에 켠 것)가 그 대상이고, 해석은 작업 위젯과 같은
 *  규칙을 쓴다(lib/api/widgetNoteTarget.ts).
 *
 *  GET  : 그 노트의 **소제목 전부**를 표시 순서대로. 지정이 없으면
 *         { instanceId: null, items: [] } — 폰이 "웹에서 켜 주세요"를 안내한다.
 *  POST : { title?, text? } → 그 노트 **맨 위에** 소제목 하나를 추가한다(요구).
 *
 *  ETag/304 지원(15분 폴링 비용 절감 — 아젠다·작업과 같은 리듬).
 */
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireDevice } from "@/lib/api/widgetDevice";
import { sha256Hex } from "@/lib/api/widgetCore";
import { noteItems, prependSection, type NoteConfigRow } from "@/lib/api/widgetNote";
import { resolveNoteTarget } from "@/lib/api/widgetNoteTarget";
import type { WidgetNoteItem } from "@/output/api-shapes";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" } as const;

/** 지정이 없을 때 폰에 그대로 보여 줄 안내. */
const NO_TARGET =
  "웹 대시보드의 '노트' 위젯 속성에서 '모바일 홈 화면에 표시'를 먼저 켜 주세요.";

export async function GET(request: NextRequest) {
  const device = await requireDevice(request);
  if (device instanceof Response) return device;

  let target;
  try {
    target = await resolveNoteTarget(createAdminClient(), device.userId);
  } catch {
    return Response.json(
      { error: "upstream", message: "노트 조회에 실패했습니다." },
      { status: 502, headers: NO_STORE },
    );
  }

  const items: WidgetNoteItem[] = target
    ? noteItems(target.id, target.config, target.updatedAt)
    : [];

  const body = { instanceId: target?.id ?? null, items };
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
  const cleanText = typeof text === "string" ? text.slice(0, 50_000) : "";
  if (!cleanTitle && !cleanText) {
    return Response.json(
      { error: "bad_request", message: "제목이나 내용을 입력해 주세요." },
      { status: 400, headers: NO_STORE },
    );
  }

  const admin = createAdminClient();
  let target;
  try {
    target = await resolveNoteTarget(admin, device.userId);
  } catch {
    target = null;
  }
  if (!target) {
    return Response.json(
      { error: "no_target", message: NO_TARGET },
      { status: 409, headers: NO_STORE },
    );
  }

  const sectionId = crypto.randomUUID();
  const next = prependSection(target.config, sectionId, cleanTitle, cleanText, Date.now());

  const { data, error } = await admin
    .from("pb_widgets")
    .update({ config: next })
    .eq("id", target.id)
    .eq("user_id", device.userId)
    .select("id, config, updated_at");
  if (error || !data?.length) {
    return Response.json(
      { error: "upstream", message: "추가에 실패했습니다." },
      { status: 502, headers: NO_STORE },
    );
  }

  const row = data[0];
  const created = noteItems(row.id, row.config as NoteConfigRow, row.updated_at).find(
    (i) => i.sectionId === sectionId,
  );
  return Response.json(created, { status: 201, headers: NO_STORE });
}
