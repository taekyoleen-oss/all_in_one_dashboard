/**
 * 폰 '노트' 위젯이 연결되는 **단 하나의** 웹 노트 위젯을 고른다.
 *
 *  작업(tasks) 위젯과 완전히 같은 방식이다 — 노트 위젯 속성의 '모바일 홈 화면에
 *  표시'(config.mobileSync)를 켠 인스턴스 중 켠 시각(mobileSyncAt)이 가장 최신인
 *  하나. 교차 인스턴스 배선 없이 config 플래그만으로 단일 지정이 성립한다
 *  (여럿 켜 두면 마지막에 켠 쪽이 이긴다 — 속성 화면에 그렇게 안내한다).
 *
 *  지정이 없으면 null이고, 호출부는 폰에 "웹에서 켜 주세요"를 안내한다. 예전처럼
 *  '공유 받기' 노트나 가장 오래된 노트로 슬쩍 떨어지지 않는다 — 어느 노트에 글이
 *  들어갈지 사용자가 명시적으로 정하게 하는 편이 안전하다.
 */

import type { createAdminClient } from "@/lib/supabase/admin";
import { pickMobileInstance } from "@/lib/api/widgetCore";
import type { NoteConfigRow } from "@/lib/api/widgetNote";

export interface NoteTarget {
  id: string;
  config: NoteConfigRow;
  updatedAt: string;
}

/** 지정된 노트 위젯 1개 — 없으면 null. */
export async function resolveNoteTarget(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<NoteTarget | null> {
  const { data, error } = await admin
    .from("pb_widgets")
    .select("id, config, updated_at")
    .eq("user_id", userId)
    .eq("type", "note");
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const id = pickMobileInstance(rows.map((r) => ({ id: r.id, config: r.config })));
  if (!id) return null;
  const row = rows.find((r) => r.id === id)!;
  return {
    id: row.id,
    config: (row.config ?? {}) as NoteConfigRow,
    updatedAt: row.updated_at,
  };
}
