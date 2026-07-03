/**
 * 노트 접기 레이아웃 계산 — 순수 함수(usePersistence.collapseNote가 사용).
 *
 *  PaneBoard 그리드는 type:null 자유 배치(컴팩션 없음)라, 노트 타일의 높이만 바꿔서는
 *  아래 위젯이 스스로 움직이지 않는다. 그래서 높이 변화량(delta = newH - oldH)만큼
 *  "노트 아래에 있고(y ≥ 노트 하단) 노트의 열 범위와 가로로 겹치는" 위젯들을 직접 y로
 *  옮긴다 — 더접기(delta<0)면 그만큼 위로, 접기(delta>0)면 정확히 그만큼 아래로. 같은
 *  delta로 함께 옮기므로 위젯 간 간격·상대 위치가 보존되고 새 겹침도 생기지 않는다.
 *
 *  React/그리드에 의존하지 않도록 구조적 타입(Rect)만 받는다 → 단위 테스트 용이.
 */

/** 위치 계산에 필요한 최소 필드(그 외 필드는 제네릭 T로 보존). */
export interface Rect {
  instanceId: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * 접기 레벨. (저장 키는 하위호환을 위해 'more'를 유지 — UI 라벨은 '소제목')
 *  - 'normal' → 펼침: 머리말+소제목+내용 전부 리스트. 높이는 사용자가 정한 그대로.
 *  - 'more'   → 소제목: 타일에 소제목 목차만 표시(내용·머리말 숨김). 높이는 목차에
 *               **딱 맞게 축소**(tocCollapseH — 아래 공백 제거 요구), 사용자 높이
 *               (base)보다 크게는 안 늘림. 펼침 복귀 시 base로 복원.
 *  - 'title'  → 제목 한 줄만 보이는 최소 높이(TITLE_COLLAPSE_H). 일기·기능 소개처럼
 *               긴 노트가 캔버스를 점유하지 않게 하고, 헤더 '전체'로 내용을 연다.
 */
export type NoteCollapseLevel = "normal" | "more" | "title";

/* ── 소제목(more) 모드 fit 높이 ──────────────────────────────────────────────
 * 그리드 행 수 ↔ px 환산은 GridCanvas의 ROW_HEIGHT(48)·margin(6)과 같아야 한다:
 * heightPx(h) = 48h + 6(h-1) = 54h - 6  →  h = ceil((px + 6) / 54).
 */
const GRID_STEP_PX = 54;
const GRID_MARGIN_PX = 6;
/** 고정 오버헤드(px): 프레임 헤더(~34) + 본문 패딩(~16) + 토글 줄(~30) + '＋ 소제목'(~24). */
const TOC_BASE_PX = 104;
/** 소제목 한 행(px): py-1(8) + text-sm 줄높이(20). */
const TOC_ROW_PX = 28;

/** 소제목 모드에서 목차(n행)에 딱 맞는 그리드 높이(행 수). */
export function tocCollapseH(sectionCount: number): number {
  const px = TOC_BASE_PX + TOC_ROW_PX * Math.max(sectionCount, 0);
  return Math.ceil((px + GRID_MARGIN_PX) / GRID_STEP_PX);
}

/**
 * '제목만' 접기의 그리드 높이(행 수). ROW_HEIGHT 48px 기준 2행(≈102px)이면
 * WidgetFrame 헤더 + 노트 제목 한 줄이 잘리지 않고 들어간다. note minSize.h와
 * 같아야 buildResponsiveLayout의 min 클램프에 되말리지 않는다.
 */
export const TITLE_COLLAPSE_H = 2;

/** 노트 config 중 접기 관련 필드(+ 소제목 fit 높이 계산용 sections 개수). */
export interface NoteCollapseConfig {
  collapse?: NoteCollapseLevel;
  normalHeight?: number;
  /** NoteConfig.sections — 'more' fit 높이에 개수만 사용(구조적 캐스트로 전달됨). */
  sections?: readonly unknown[];
}

export interface CollapseResult<T extends Rect> {
  /** 노트 h 변경 + 아래 위젯 이동이 반영된 새 레이아웃(불변, 새 배열). */
  layout: T[];
  /** 노트에 병합할 접기 config(collapse/normalHeight). */
  config: NoteCollapseConfig;
  /** 위치가 바뀐(따라 이동한) 노트 외 위젯 id 목록. */
  movedIds: string[];
  /** 실제로 바뀐 게 있으면 true(아니면 호출부에서 no-op 처리). */
  changed: boolean;
}

/**
 * 노트를 `level`로 접거나 펴는 새 레이아웃·config를 계산한다.
 *  - level 'more'   → 목차 fit 높이(tocCollapseH, base 상한)로 축소 — 소제목만
 *                     보이는 만큼만 차지(아래 공백 제거). normalHeight에 기준 높이 캡처.
 *  - level 'title'  → 제목 한 줄 높이(TITLE_COLLAPSE_H)로. normalHeight 캡처는 동일.
 *  - level 'normal' → 기억해 둔 normalHeight로 h 복원.
 * base = 현재 'normal'이면 지금 h, 이미 접혀 있으면 기억해 둔 normalHeight — 그래서
 * more↔title을 오가도 원래 높이가 보존된다. 높이 변화량(delta)만큼 아래 위젯을
 * 함께 이동. minH(노트 minSize.h) 미만으로는 안 줄임.
 */
export function computeNoteCollapse<T extends Rect>(
  layout: T[],
  noteId: string,
  noteConfig: NoteCollapseConfig,
  level: NoteCollapseLevel,
  minH: number,
): CollapseResult<T> {
  const item = layout.find((l) => l.instanceId === noteId);
  const curLevel = noteConfig.collapse ?? "normal";
  if (!item) {
    return {
      layout,
      config: { collapse: curLevel, normalHeight: noteConfig.normalHeight },
      movedIds: [],
      changed: false,
    };
  }

  // 접기 기준 높이: 펼쳐진(normal) 상태면 지금 h, 이미 접힌 상태면 접기 직전 높이.
  const base =
    curLevel === "normal" ? item.h : noteConfig.normalHeight ?? item.h;

  let newH = item.h;
  let config: NoteCollapseConfig;
  if (level === "more") {
    // 소제목 모드: 목차(소제목 개수)에 딱 맞게 축소(아래 공백 제거 요구) —
    // 사용자 높이(base)보다 크게는 안 늘리고(넘치면 내부 스크롤), minH 이상.
    const fit = tocCollapseH(noteConfig.sections?.length ?? 0);
    newH = Math.max(Math.min(fit, base), minH);
    config = { collapse: "more", normalHeight: base };
  } else if (level === "title") {
    newH = Math.max(TITLE_COLLAPSE_H, minH);
    config = { collapse: "title", normalHeight: base };
  } else {
    newH = Math.max(base, minH);
    config = { collapse: "normal", normalHeight: noteConfig.normalHeight };
  }

  if (newH === item.h && curLevel === level) {
    return { layout, config, movedIds: [], changed: false };
  }

  const delta = newH - item.h;
  const oldBottom = item.y + item.h;
  const movedIds: string[] = [];
  const nextLayout = layout.map((l) => {
    if (l.instanceId === noteId) return { ...l, h: newH };
    // 노트 아래(y ≥ 옛 하단) + 노트 열과 가로로 겹침 → 함께 이동. 옆 열은 제외.
    if (
      delta !== 0 &&
      l.y >= oldBottom &&
      l.x < item.x + item.w &&
      item.x < l.x + l.w
    ) {
      movedIds.push(l.instanceId);
      return { ...l, y: Math.max(0, l.y + delta) };
    }
    return l;
  });

  return { layout: nextLayout, config, movedIds, changed: true };
}
