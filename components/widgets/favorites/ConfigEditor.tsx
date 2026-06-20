"use client";

/**
 * favorites · ConfigEditor — manage the link list (설계서 §2.1 #3).
 *
 *  Delegates to LinkManager (label + url + optional group; add/remove/reorder).
 *  All changes report up via onChange (parent owns persistence).
 */

import * as React from "react";
import type { ConfigEditorProps } from "@/lib/widgets/contract";
import { LinkManager } from "./LinkManager";
import type { FavoritesConfig } from "./types";

export function FavoritesConfigEditor({
  config,
  onChange,
}: ConfigEditorProps<FavoritesConfig>) {
  return (
    <div className="flex flex-col gap-2">
      <LinkManager config={config} onChange={onChange} />
    </div>
  );
}

export default FavoritesConfigEditor;
