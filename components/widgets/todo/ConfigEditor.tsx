"use client";

/**
 * todo · ConfigEditor — manage the checklist (설계서 §2.2).
 *
 *  Delegates to ItemManager (title + add/edit/remove/reorder/toggle). All changes
 *  report up via onChange (parent owns persistence).
 *
 *  // TODO(persist): items currently live in pb_widgets.config; a later chunk may
 *  // optionally move them to a `pb_todos`-style table.
 */

import * as React from "react";
import type { ConfigEditorProps } from "@/lib/widgets/contract";
import { ItemManager } from "./ItemManager";
import type { TodoConfig } from "./types";

export function TodoConfigEditor({ config, onChange }: ConfigEditorProps<TodoConfig>) {
  return (
    <div className="flex flex-col gap-2">
      <ItemManager config={config} onChange={onChange} />
    </div>
  );
}

export default TodoConfigEditor;
