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
