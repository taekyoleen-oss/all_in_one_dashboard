"use client";

/**
 * Widget persistence context — lets a CompactView/ExpandedView persist its own
 * config WITHOUT the edit dialog (e.g. memo inline editing, double-click title
 * rename). CanvasShell provides its `saveConfig`; widgets read it via
 * `useSaveWidgetConfig()`. saveConfig REPLACES the whole config, so callers pass
 * the full merged object (e.g. `{ ...config, text }`).
 */

import * as React from "react";

type SaveConfigFn = (instanceId: string, nextConfig: unknown) => void;

const SaveConfigContext = React.createContext<SaveConfigFn | null>(null);

export function WidgetPersistenceProvider({
  save,
  children,
}: {
  save: SaveConfigFn;
  children: React.ReactNode;
}) {
  return (
    <SaveConfigContext.Provider value={save}>
      {children}
    </SaveConfigContext.Provider>
  );
}

/** Returns a stable saver; a no-op when no provider is mounted (e.g. previews). */
export function useSaveWidgetConfig(): SaveConfigFn {
  return React.useContext(SaveConfigContext) ?? noop;
}

const noop: SaveConfigFn = () => {};
