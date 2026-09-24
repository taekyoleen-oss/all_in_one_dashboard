/**
 * 폰의 **읽기 전용** 위젯(주식·환율)이 볼 웹 위젯 인스턴스를 고른다.
 *
 *  규칙은 작업·노트와 같다 — 위젯 속성의 '모바일 홈 화면에 표시'(config.mobileSync)를
 *  켠 것 중 마지막에 켠 하나. 다만 지정이 없고 **그 종류 위젯이 하나뿐이면 그것**을
 *  쓴다(pickMobileInstanceOrOnly): 고를 여지가 없는데 "웹에서 켜세요"를 띄우면 일만
 *  늘고, 시세를 잘못 보여 줄 위험도 없다(폰이 쓰는 값이 없는 읽기 전용이다).
 *
 *  작업·노트에는 이 폴백을 쓰지 않는다 — 거기서는 폰이 **글을 쓰기** 때문에 대상이
 *  틀리면 엉뚱한 노트가 고쳐진다(v19에서 명시 지정으로 바꾼 이유).
 */

import type { createAdminClient } from "@/lib/supabase/admin";
import { pickMobileInstanceOrOnly } from "@/lib/api/widgetCore";

export interface MobileTarget<T> {
  id: string;
  config: T;
}

/** `type` 위젯 중 폰이 볼 인스턴스 1개 — 없으면 null. */
export async function resolveMobileTarget<T>(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  type: string,
): Promise<MobileTarget<T> | null> {
  const { data, error } = await admin
    .from("pb_widgets")
    .select("id, config")
    .eq("user_id", userId)
    .eq("type", type);
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const id = pickMobileInstanceOrOnly(rows.map((r) => ({ id: r.id, config: r.config })));
  if (!id) return null;
  const row = rows.find((r) => r.id === id)!;
  return { id: row.id, config: (row.config ?? {}) as T };
}
