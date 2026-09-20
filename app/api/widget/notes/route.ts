/**
 * /api/widget/notes — 모바일 홈 화면 '노트' 위젯의 목록·추가(Bearer 디바이스 토큰).
 *
 *  GET  : 이 사용자의 웹 '노트' 위젯들 안의 **소제목 섹션 전부**를 한 줄씩.
 *         노트는 최근 수정 순, 노트 안에서는 소제목 순서 그대로. ETag/304 지원.
 *  POST : { title?, text? } → 대상 노트 맨 아래에 **소제목 하나**를 추가한다.
 *
 *  대상 노트는 `/share`(모바일 공유 받기)와 **같은 규칙**으로 고른다 —
 *  `config.shareTarget === true`인 노트(최근 수정), 없으면 가장 오래된 노트.
 *  "모바일에서 들어오는 것을 받는 노트"라는 뜻이 이미 그 플래그에 있으므로
 *  새 설정을 만들지 않는다.
 */
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireDevice } from "@/lib/api/widgetDevice";
import { sha256Hex } from "@/lib/api/widgetCore";
import { appendSection, noteItems, type NoteConfigRow } from "@/lib/api/widgetNote";
import type { WidgetNoteItem } from "@/output/api-shapes";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" } as const;

type NoteRow = { id: string; config: NoteConfigRow; updated_at: string };

/** 이 사용자의 노트 위젯들 — 최근 수정 순. */
async function loadNotes(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<NoteRow[]> {
  const { data, error } = await admin
    .from("pb_widgets")
    .select("id, config, updated_at")
    .eq("user_id", userId)
    .eq("type", "note")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id,
    config: (r.config ?? {}) as NoteConfigRow,
    updated_at: r.updated_at,
  }));
}

export async function GET(request: NextRequest) {
  const device = await requireDevice(request);
  if (device instanceof Response) return device;

  let notes: NoteRow[];
  try {
    notes = await loadNotes(createAdminClient(), device.userId);
  } catch {
    return Response.json(
      { error: "upstream", message: "노트 조회에 실패했습니다." },
      { status: 502, headers: NO_STORE },
    );
  }

  const items: WidgetNoteItem[] = notes.flatMap((n) =>
    noteItems(n.id, n.config, n.updated_at),
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
  const cleanText = typeof text === "string" ? text.slice(0, 50_000) : "";
  if (!cleanTitle && !cleanText) {
    return Response.json(
      { error: "bad_request", message: "제목이나 내용을 입력해 주세요." },
      { status: 400, headers: NO_STORE },
    );
  }

  const admin = createAdminClient();
  let notes: NoteRow[];
  try {
    notes = await loadNotes(admin, device.userId);
  } catch {
    notes = [];
  }
  if (notes.length === 0) {
    return Response.json(
      {
        error: "no_target",
        message: "웹 대시보드에 '노트' 위젯을 먼저 추가해 주세요.",
      },
      { status: 409, headers: NO_STORE },
    );
  }
  // /share와 같은 규칙: 공유 받기 노트 → 없으면 가장 오래된 노트(목록이 최신순이라 마지막).
  const target =
    notes.find((n) => n.config.shareTarget === true) ?? notes[notes.length - 1];

  const sectionId = crypto.randomUUID();
  const next = appendSection(target.config, sectionId, cleanTitle, cleanText, Date.now());

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
