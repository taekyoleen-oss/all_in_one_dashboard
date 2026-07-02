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
 * 접기 레벨.
 *  - 'normal' → 사용자가 설정한 높이 그대로(기본).
 *  - 'more'   → 그 높이의 절반.
 *  - 'title'  → 제목 한 줄만 보이는 최소 높이(TITLE_COLLAPSE_H). 일기·기능 소개처럼
 *               긴 노트가 캔버스를 점유하지 않게 하고, 제목 클릭으로 바로 '전체'를 연다.
 */
export type NoteCollapseLevel = "normal" | "more" | "title";

/**
 * '제목만' 접기의 그리드 높이(행 수). ROW_HEIGHT 48px 기준 2행(≈102px)이면
 * WidgetFrame 헤더 + 노트 제목 한 줄이 잘리지 않고 들어간다. note minSize.h와
 * 같아야 buildResponsiveLayout의 min 클램프에 되말리지 않는다.
 */
export const TITLE_COLLAPSE_H = 2;

/** 노트 config 중 접기 관련 필드. */
export interface NoteCollapseConfig {
  collapse?: NoteCollapseLevel;
  normalHeight?: number;
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
 *  - level 'more'   → 기준 높이(base)의 절반으로. normalHeight에 접기 직전 높이를 캡처.
 *  - level 'title'  → 제목 한 줄 높이(TITLE_COLLAPSE_H)로. normalHeight 캡처는 동일.
 *  - level 'normal' → 기억해 둔 normalHeight로 h 복원.
 * base = 현재 'normal'이면 지금 h, 이미 접혀 있으면 기억해 둔 normalHeight — 그래서
 * more↔title을 오가도 원래 높이가 보존되고, 연속 클릭이 1/4로 쪼개지지 않는다.
 * 모든 경우 아래 위젯을 delta만큼 함께 이동. minH(노트 minSize.h) 미만으로는 안 줄임.
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
    newH = Math.max(Math.round(base / 2), minH);
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
