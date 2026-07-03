/**
 * '소제목만 열기' 핸드오프 — 타일(CompactView)에서 소제목을 클릭하면 어느 섹션을
 * 열지 여기 적어 두고 openFocus(instanceId)를 호출한다. FocusOverlay가 마운트한
 * ExpandedView가 peek으로 읽어 단일 섹션 모드로 시작하고, 마운트 후 clear한다.
 *
 *  일회성 UI 의도(어떤 섹션을 열까)일 뿐 영속 상태가 아니므로 config/DB를 거치지
 *  않고 모듈 스코프 Map으로 전달한다(같은 클라이언트 트리 안의 타일 ↔ 오버레이).
 *  peek/clear를 분리한 이유: StrictMode가 useState 초기화를 두 번 호출해도
 *  안전하도록 읽기는 순수하게 두고, 소거는 마운트 효과에서 한 번만 한다.
 */

const pending = new Map<string, string>();

/** 다음에 열릴 전체보기가 이 섹션만 보여주도록 예약한다. */
export function setPendingNoteSection(instanceId: string, sectionId: string): void {
  pending.set(instanceId, sectionId);
}

/** 예약된 섹션 id를 읽는다(소거하지 않음 — 순수). 없으면 null. */
export function peekPendingNoteSection(instanceId: string): string | null {
  return pending.get(instanceId) ?? null;
}

/** 예약 소거 — 전체(모든 섹션) 열기 직전, 그리고 오버레이 마운트 후 호출. */
export function clearPendingNoteSection(instanceId: string): void {
  pending.delete(instanceId);
}
