/**
 * memo — WidgetDefinition (설계서 §2.1 #2). copyBehavior: 'content' (copies the
 * memo body). Config-driven: every view renders from `config`, so editing config
 * re-renders the tile.
 */

import { NotebookPen } from "lucide-react";
import type { WidgetDefinition } from "@/lib/widgets/contract";
import { MemoCompactView } from "./CompactView";
import { MemoExpandedView } from "./ExpandedView";
import { MemoConfigEditor } from "./ConfigEditor";
import { DEFAULT_MEMO_CONFIG, type MemoConfig } from "./types";

export const memoWidget: WidgetDefinition<MemoConfig> = {
  type: "memo",
  displayName: "메모",
  icon: NotebookPen,
  category: "core",
  defaultConfig: DEFAULT_MEMO_CONFIG,
  defaultSize: { w: 3, h: 2 },
  minSize: { w: 2, h: 1 },
  maxSize: { w: 8, h: 6 },
  CompactView: MemoCompactView,
  ExpandedView: MemoExpandedView,
  ConfigEditor: MemoConfigEditor,
  copyBehavior: "content",
  dataMode: "static",
};

export default memoWidget;
export type { MemoConfig } from "./types";
