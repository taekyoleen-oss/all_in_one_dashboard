/**
 * /api/widget/notes/[id]/[sectionId] — 소제목 1건 수정·삭제(Bearer 디바이스 토큰).
 *
 *  대상은 **지정된 노트 위젯 하나**로 한정한다 — 웹에서 지정을 다른 노트로 옮기면
 *  폰의 옛 캐시로 들어온 수정·삭제는 409로 막힌다(다음 동기화에서 목록이 새 노트
 *  것으로 갈린다). 엉뚱한 노트를 고치는 사고보다 한 번 튕기는 편이 낫다.
 *
 *  PATCH  : { title?, text? } — 있는 필드만. POST는 별칭(안드로이드
 *           HttpURLConnection이 PATCH를 못 보내는 자바 한계 우회).
 *  DELETE : 그 소제목만 제거. 노트 위젯 자체는 남는다 — 메모 모델과 달리
 *           삭제가 캔버스의 위젯을 없애지 않으므로 폰에서 허용한다(요구).
 *
 *  경로를 두 조각(노트 id / 섹션 id)으로 나눈 이유: 합친 키를 한 조각에 넣으면
 *  구분자 인코딩을 양쪽에서 맞춰야 해서 깨지기 쉽다.
 *
 *  ⚠ 이미지·표가 든 섹션은 본문 수정을 거부한다(409) — 평문으로 덮어쓰면 data URL
 *    이미지와 표가 복구 불가능하게 사라진다. 제목 수정과 삭제는 허용한다.
 */
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireDevice } from "@/lib/api/widgetDevice";
import { resolveNoteTarget } from "@/lib/api/widgetNoteTarget";
import {
  deleteSection,
  hasRichBlocks,
  htmlToPlainText,
  noteItems,
  sectionsOf,
  updateSection,
  type NoteConfigRow,
} from "@/lib/api/widgetNote";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" } as const;

/**
 * 요청한 노트가 **지금 모바일에 지정된 그 노트**인지 확인하고 config를 준다.
 * 지정이 없거나 다른 노트를 가리키면 null → 호출부가 409로 막는다.
 */
async function loadTargetNote(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  id: string,
): Promise<{ config: NoteConfigRow } | null> {
  const target = await resolveNoteTarget(admin, userId).catch(() => null);
  if (!target || target.id !== id) return null;
  return { config: target.config };
}

/** 지정이 어긋났을 때의 응답(폰이 그대로 보여 준다). */
const notTargeted = () =>
  Response.json(
    {
      error: "no_target",
      message:
        "이 노트는 모바일 대상이 아닙니다. 웹에서 '모바일 홈 화면에 표시'를 확인해 주세요.",
    },
    { status: 409, headers: NO_STORE },
  );

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/widget/notes/[id]/[sectionId]">,
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
    patch.text = text.slice(0, 50_000);
  }
  if (Object.keys(patch).length === 0) {
    return Response.json(
      { error: "bad_request", message: "수정할 필드가 없습니다." },
      { status: 400, headers: NO_STORE },
    );
  }

  const { id, sectionId } = await ctx.params;
  const admin = createAdminClient();
  const note = await loadTargetNote(admin, device.userId, id);
  if (!note) return notTargeted();

  const current = sectionsOf(note.config).find((s) => s.id === sectionId);
  if (!current) {
    return Response.json(
      { error: "not_found", message: "소제목을 찾을 수 없습니다." },
      { status: 404, headers: NO_STORE },
    );
  }
  // 이미지·표가 든 섹션의 **본문**은 폰이 덮어쓰지 못한다(내용이 사라진다).
  // 평문이 그대로면 어차피 html을 건드리지 않으므로 통과시킨다.
  if (
    patch.text !== undefined &&
    hasRichBlocks(current.html) &&
    patch.text !== htmlToPlainText(current.html)
  ) {
    return Response.json(
      {
        error: "rich_content",
        message: "이미지·표가 있는 소제목은 웹에서 수정해 주세요(휴대폰에서 고치면 사라집니다).",
      },
      { status: 409, headers: NO_STORE },
    );
  }

  const next = updateSection(note.config, sectionId, patch, Date.now());
  if (!next) {
    return Response.json(
      { error: "not_found", message: "소제목을 찾을 수 없습니다." },
      { status: 404, headers: NO_STORE },
    );
  }

  const { data, error } = await admin
    .from("pb_widgets")
    .update({ config: next })
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
  const item = noteItems(row.id, row.config as NoteConfigRow, row.updated_at).find(
    (i) => i.sectionId === sectionId,
  );
  return Response.json(item, { headers: NO_STORE });
}

export const POST = PATCH;

export async function DELETE(
  request: NextRequest,
  ctx: RouteContext<"/api/widget/notes/[id]/[sectionId]">,
) {
  const device = await requireDevice(request);
  if (device instanceof Response) return device;

  const { id, sectionId } = await ctx.params;
  const admin = createAdminClient();
  const note = await loadTargetNote(admin, device.userId, id);
  if (!note) return notTargeted();

  const next = deleteSection(note.config, sectionId);
  if (!next) {
    return Response.json(
      { error: "not_found", message: "소제목을 찾을 수 없습니다." },
      { status: 404, headers: NO_STORE },
    );
  }

  const { error } = await admin
    .from("pb_widgets")
    .update({ config: next })
    .eq("id", id)
    .eq("user_id", device.userId);
  if (error) {
    return Response.json(
      { error: "upstream", message: "삭제에 실패했습니다." },
      { status: 502, headers: NO_STORE },
    );
  }
  return Response.json({ noteId: id, sectionId, deleted: true }, { headers: NO_STORE });
}
