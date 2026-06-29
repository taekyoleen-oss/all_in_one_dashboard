"use client";

/**
 * Widget persistence context — lets a CompactView/ExpandedView persist its own
 * config WITHOUT the edit dialog (e.g. memo inline editing, double-click title
 * rename). CanvasShell provides its `saveConfig`; widgets read it via
 * `useSaveWidgetConfig()`. saveConfig REPLACES the whole config, so callers pass
 * the full merged object (e.g. `{ ...config, text }`).
 *
 * It ALSO exposes `setShareTargetNote(instanceId, on)` — a CROSS-instance action
 * (note's "공유 받기"): enabling it on one note clears the flag on every other
 * note across all boards, so exactly one note is the mobile-share destination.
 */

import * as React from "react";

type SaveConfigFn = (instanceId: string, nextConfig: unknown) => void;
type SetShareTargetFn = (instanceId: string, on: boolean) => void;
type CollapseNoteFn = (instanceId: string, level: "normal" | "more") => void;

interface WidgetPersistenceValue {
  save: SaveConfigFn;
  setShareTargetNote: SetShareTargetFn;
  collapseNote: CollapseNoteFn;
}

const WidgetPersistenceContext =
  React.createContext<WidgetPersistenceValue | null>(null);

export function WidgetPersistenceProvider({
  save,
  setShareTargetNote,
  collapseNote,
  children,
}: {
  save: SaveConfigFn;
  setShareTargetNote: SetShareTargetFn;
  collapseNote: CollapseNoteFn;
  children: React.ReactNode;
}) {
  const value = React.useMemo<WidgetPersistenceValue>(
    () => ({ save, setShareTargetNote, collapseNote }),
    [save, setShareTargetNote, collapseNote],
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

/** Cross-instance: designate the single "공유 받기" note (clears all others). */
export function useSetShareTargetNote(): SetShareTargetFn {
  return (
    React.useContext(WidgetPersistenceContext)?.setShareTargetNote ??
    noopShareTarget
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
const noopShareTarget: SetShareTargetFn = () => {};
const noopCollapse: CollapseNoteFn = () => {};
