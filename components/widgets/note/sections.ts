/**
 * 노트 소제목 섹션 — 순수 배열 연산(NoteEditor·ConfigEditor가 사용).
 *
 *  config.sections는 jsonb로 왕복하는 불변 데이터라 모든 조작이 새 배열을 반환한다.
 *  변경이 없으면(모르는 id, 경계 밖 이동) **원본 배열 참조를 그대로** 반환해 호출부가
 *  no-op 저장을 건너뛸 수 있게 한다. React 비의존 → 단위 테스트 용이(collapseLayout 패턴).
 */

import type { NoteSection } from "./types";

/** 빈 소제목 섹션 생성 — id는 호출부가 공급(crypto.randomUUID). */
export function createSection(id: string): NoteSection {
  return { id, title: "", html: "" };
}

/**
 * 지정 위치에 섹션 삽입 — 상단 메뉴의 '위에/아래에 추가'가 쓴다.
 * index는 [0, length]로 클램프하므로 빈 배열·경계 밖 값도 안전하다.
 */
export function insertSectionAt(
  sections: NoteSection[],
  section: NoteSection,
  index: number,
): NoteSection[] {
  const at = Math.max(0, Math.min(index, sections.length));
  const next = sections.slice();
  next.splice(at, 0, section);
  return next;
}

/**
 * '지금 커서가 있는 위치' 기준 삽입 지점.
 *  - 커서가 어떤 섹션 안이면 그 섹션의 바로 위(i) / 아래(i+1)
 *  - 커서가 **머리말**(맨 위)이거나 아직 아무 데도 없으면 → 항상 0.
 *    머리말은 모든 소제목보다 위에 있어서 그 기준의 위/아래가 모두 목록의 맨 앞이다.
 *    (예전엔 'below'를 맨 끝으로 보내 "맨 아래에 생긴다"는 오동작이 있었다.)
 * 활성 key는 섹션 id 또는 머리말 키 — 섹션에 없는 key는 머리말로 취급한다.
 */
export function insertIndexFor(
  sections: NoteSection[],
  activeKey: string | null,
  where: "above" | "below",
): number {
  const i = activeKey ? sections.findIndex((s) => s.id === activeKey) : -1;
  if (i < 0) return 0;
  return where === "above" ? i : i + 1;
}

/** 대상 섹션에 patch 병합. 모르는 id면 원본 참조 반환. */
export function updateSectionById(
  sections: NoteSection[],
  id: string,
  patch: Partial<Omit<NoteSection, "id">>,
): NoteSection[] {
  if (!sections.some((s) => s.id === id)) return sections;
  return sections.map((s) => (s.id === id ? { ...s, ...patch } : s));
}

/** 대상 섹션 제거. 모르는 id면 원본 참조 반환. */
export function removeSectionById(
  sections: NoteSection[],
  id: string,
): NoteSection[] {
  const next = sections.filter((s) => s.id !== id);
  return next.length === sections.length ? sections : next;
}

/** 섹션을 위(-1)/아래(+1)로 한 칸 이동. 경계 밖·모르는 id면 원본 참조 반환. */
export function moveSectionById(
  sections: NoteSection[],
  id: string,
  dir: -1 | 1,
): NoteSection[] {
  const i = sections.findIndex((s) => s.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= sections.length) return sections;
  const next = sections.slice();
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}
