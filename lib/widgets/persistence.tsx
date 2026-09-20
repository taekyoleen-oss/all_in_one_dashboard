"use client";

/**
 * Widget persistence context — lets a CompactView/ExpandedView persist its own
 * config WITHOUT the edit dialog (e.g. memo inline editing, double-click title
 * rename). CanvasShell provides its `saveConfig`; widgets read it via
 * `useSaveWidgetConfig()`. saveConfig REPLACES the whole config, so callers pass
 * the full merged object (e.g. `{ ...config, text }`).
 *
 * It ALSO exposes `setExclusiveNoteFlag(instanceId, flag, on)` — a CROSS-instance
 * action for the note flags that mean "고른 하나": '공유 받기'(shareTarget)와
 * '모바일 홈 화면에 표시'(mobileSync). 켜면 다른 모든 노트에서 그 플래그가 꺼져
 * 항상 정확히 하나만 지정된다.
 */

import * as React from "react";
import type { NoteCollapseLevel } from "@/components/widgets/note/collapseLayout";

type SaveConfigFn = (instanceId: string, nextConfig: unknown) => void;
export type ExclusiveNoteFlag = "shareTarget" | "mobileSync";
type SetExclusiveNoteFlagFn = (
  instanceId: string,
  flag: ExclusiveNoteFlag,
  on: boolean,
) => void;
type CollapseNoteFn = (instanceId: string, level: NoteCollapseLevel) => void;

interface WidgetPersistenceValue {
  save: SaveConfigFn;
  setExclusiveNoteFlag: SetExclusiveNoteFlagFn;
  collapseNote: CollapseNoteFn;
}

const WidgetPersistenceContext =
  React.createContext<WidgetPersistenceValue | null>(null);

export function WidgetPersistenceProvider({
  save,
  setExclusiveNoteFlag,
  collapseNote,
  children,
}: {
  save: SaveConfigFn;
  setExclusiveNoteFlag: SetExclusiveNoteFlagFn;
  collapseNote: CollapseNoteFn;
  children: React.ReactNode;
}) {
  const value = React.useMemo<WidgetPersistenceValue>(
    () => ({ save, setExclusiveNoteFlag, collapseNote }),
    [save, setExclusiveNoteFlag, collapseNote],
  );
  return (
    <WidgetPersistenceContext.Provider value={value}>
      {children}
    </WidgetPersistenceContext.Provider>
  );
}

/** Returns a stable saver; a no-op when no provider is mounted (e.g. previews). */
export function useSaveWidgetConfig(): SaveConfigFn {
  return React.useContext(WidgetPersistenceContext)?.save ?? noopSave;
}

/**
 * Cross-instance: 노트 단일 지정 플래그를 켠다/끈다(나머지 노트는 전부 꺼진다).
 * '공유 받기'와 '모바일 홈 화면에 표시' 둘 다 이걸 쓴다.
 */
export function useSetExclusiveNoteFlag(): SetExclusiveNoteFlagFn {
  return (
    React.useContext(WidgetPersistenceContext)?.setExclusiveNoteFlag ??
    noopExclusiveNoteFlag
  );
}

/**
 * Breakpoint-aware collapse OVERRIDE provided by GridCanvas. On desktop (lg) the
 * canvas just delegates to the DB collapse below; on mobile/tablet (md/sm) it
 * ALSO shifts the device-local layout so the note tile shrinks AND the widgets
 * below rise/fall — exactly like desktop. When GridCanvas is not in the tree
 * (e.g. previews), this is null and useCollapseNote falls back to the DB collapse.
 */
const NoteCollapseOverrideContext =
  React.createContext<CollapseNoteFn | null>(null);

export function NoteCollapseOverrideProvider({
  collapseNote,
  children,
}: {
  collapseNote: CollapseNoteFn;
  children: React.ReactNode;
}) {
  return (
    <NoteCollapseOverrideContext.Provider value={collapseNote}>
      {children}
    </NoteCollapseOverrideContext.Provider>
  );
}

/** Collapse a note tile to half its height (or restore). No-op without a provider. */
export function useCollapseNote(): CollapseNoteFn {
  // GridCanvas's breakpoint-aware override wins (handles mobile device layouts);
  // otherwise the plain DB collapse (lg only) from WidgetPersistenceProvider.
  const override = React.useContext(NoteCollapseOverrideContext);
  const base = React.useContext(WidgetPersistenceContext)?.collapseNote;
  return override ?? base ?? noopCollapse;
}

const noopSave: SaveConfigFn = () => {};
const noopExclusiveNoteFlag: SetExclusiveNoteFlagFn = () => {};
const noopCollapse: CollapseNoteFn = () => {};

/* ---------------------- widget focus (전체보기 열기/닫기) ---------------------- */

type OpenFocusFn = (instanceId: string) => void;

/**
 * GridCanvas가 제공 — 위젯 내부(예: 노트 '제목만' 타일의 제목 클릭)에서 자신의
 * '전체'(FocusOverlay)를 연다. WidgetFrame의 전체 버튼과 같은 onFocusInstance 경로.
 */
const WidgetFocusContext = React.createContext<OpenFocusFn | null>(null);

export function WidgetFocusProvider({
  openFocus,
  children,
}: {
  openFocus: OpenFocusFn | null;
  children: React.ReactNode;
}) {
  return (
    <WidgetFocusContext.Provider value={openFocus}>
      {children}
    </WidgetFocusContext.Provider>
  );
}

/** '전체' 열기 함수 — 제공자가 없으면 null(호출부에서 어포던스를 숨긴다). */
export function useOpenWidgetFocus(): OpenFocusFn | null {
  return React.useContext(WidgetFocusContext);
}

/**
 * FocusOverlay가 제공 — ExpandedView 내부에서 오버레이 자신을 닫는다(백스택 경유).
 * 예: 노트 전체보기의 '제목만 접기'가 접기+닫기를 한 번에 수행할 때.
 */
const FocusCloseContext = React.createContext<(() => void) | null>(null);

export function FocusCloseProvider({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <FocusCloseContext.Provider value={onClose}>
      {children}
    </FocusCloseContext.Provider>
  );
}

/** 포커스 오버레이 닫기 함수 — 오버레이 밖(타일 등)에서는 null. */
export function useCloseWidgetFocus(): (() => void) | null {
  return React.useContext(FocusCloseContext);
}
