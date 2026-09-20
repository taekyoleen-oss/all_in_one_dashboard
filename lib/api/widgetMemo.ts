/**
 * ============================================================================
 *  메모 브리지 — config(jsonb) ↔ 폰 목록 사이의 순수 변환
 * ============================================================================
 *
 *  메모 한 건 = 웹 '메모' 위젯 인스턴스 하나이고, 본문은 `pb_widgets.config`에
 *  산다(작업처럼 전용 테이블이 없다). 그래서 이 파일이 지키는 두 가지 불변식이
 *  브리지 전체의 안전장치다:
 *
 *  ① **잠긴 메모의 본문은 절대 나가지 않는다.** 메모 잠금은 화면 잠금이고 본문은
 *     config에 평문이라, 폰에 그대로 내려보내면 잠금이 아무것도 막지 못한다.
 *  ② **폰의 수정은 config를 통째로 바꾸지 않는다.** 폰은 제목·본문만 알고 색·글자
 *     크기·비밀번호 해시·자동잠금 시간은 모른다 — 통째로 쓰면 그 값들이 지워진다.
 *     그래서 서버가 현재 config를 읽어 **해당 필드만 덮어쓴 새 객체**를 만든다.
 *
 *  ⚠ 남는 경합(설계상 한계): 웹 화면이 열려 있는 채 폰에서 고치면, 웹은 메모리에
 *    든 옛 config를 들고 있다가 디바운스 저장 때 되덮을 수 있다. pb_widgets는
 *    realtime 발행 대상이 아니어서(pb_tasks·pb_clipboard만) 웹이 즉시 알 수 없기
 *    때문이다. 웹 쪽 완화는 `components/widgets/memo/useMemoRemoteSync.ts`
 *    (창 포커스 복귀 시 자기 행 재조회)에 있다.
 */

import type { Json } from "@/output/types/database";
import type { WidgetMemo } from "@/output/api-shapes";

/**
 * pb_widgets.config 한 덩어리. 메모가 읽는 키는 title·text·pwHash뿐이고 나머지는
 * 이름도 모른 채 그대로 보존한다 — 그래서 값 타입을 Json으로 열어 둔다(그래야
 * 병합 결과를 그대로 다시 저장할 수 있다).
 */
export type MemoConfigRow = { [key: string]: Json | undefined };

/** 비밀번호 해시가 있으면 잠긴 메모다(빈 문자열·null은 잠금 아님). */
export function isLockedMemo(config: MemoConfigRow | null | undefined): boolean {
  const h = config?.pwHash;
  return typeof h === "string" && h.length > 0;
}

const str = (v: Json | undefined): string => (typeof v === "string" ? v : "");

/** 위젯 행 → 폰 목록 1건. 잠긴 메모는 제목만 준다(본문은 빈 문자열). */
export function memoRow(
  id: string,
  config: MemoConfigRow | null | undefined,
  updatedAt: string,
): WidgetMemo {
  const locked = isLockedMemo(config);
  const title = str(config?.title).trim();
  return {
    id,
    // 제목이 비면 폰 목록에서 빈 줄이 된다 — 목록은 제목으로 고르는 화면이라
    // 빈 줄을 두느니 본문 첫 줄로 대신하고, 그마저 없으면 '제목 없음'.
    title: title || firstLine(locked ? "" : str(config?.text)) || "제목 없음",
    body: locked ? "" : str(config?.text),
    locked,
    updatedAt,
  };
}

/** 본문 첫 줄(최대 40자) — 제목 없는 메모의 목록 표시용. */
function firstLine(text: string): string {
  const line = text.split("\n").find((l) => l.trim().length > 0)?.trim() ?? "";
  return line.length > 40 ? `${line.slice(0, 40)}…` : line;
}

/**
 * 폰이 보낸 제목·본문을 현재 config에 **병합**한다(불변식 ②).
 * 주어지지 않은 필드는 손대지 않고, 색·크기·비밀번호 등 다른 키도 그대로 남는다.
 */
export function mergeMemoConfig(
  current: MemoConfigRow | null | undefined,
  patch: { title?: string; text?: string },
): MemoConfigRow {
  const next: MemoConfigRow = { ...(current ?? {}) };
  if (patch.title !== undefined) next.title = patch.title;
  if (patch.text !== undefined) next.text = patch.text;
  return next;
}
