"use client";

/**
 * dday · ConfigEditor — manage multiple D-Day entries (설계서 §2.2).
 *
 *  Delegates to EntryManager (label + date + repeat-yearly, add/remove/reorder).
 *  All changes report up via onChange (parent owns persistence).
 */

import * as React from "react";
import type { ConfigEditorProps } from "@/lib/widgets/contract";
import { EntryManager } from "./EntryManager";
import type { DDayConfig } from "./types";

export function DDayConfigEditor({ config, onChange }: ConfigEditorProps<DDayConfig>) {
  return (
    <div className="flex flex-col gap-2">
      <EntryManager config={config} onChange={onChange} />
    </div>
  );
}

export default DDayConfigEditor;
