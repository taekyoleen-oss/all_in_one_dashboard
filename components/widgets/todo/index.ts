/**
 * todo — WidgetDefinition (설계서 §2.2). dataMode: 'static' (items in config).
 * copyBehavior: 'config' (duplicate the checklist). Config-driven: every view
 * renders from `config`, so editing config re-renders the tile.
 *
 * // TODO(persist): items live in pb_widgets.config for now; may later optionally
 * // use a `pb_todos`-style table.
 */

import { ListChecks } from "lucide-react";
import type { WidgetDefinition } from "@/lib/widgets/contract";
import { TodoCompactView } from "./CompactView";
import { TodoExpandedView } from "./ExpandedView";
import { TodoConfigEditor } from "./ConfigEditor";
import { DEFAULT_TODO_CONFIG, type TodoConfig } from "./types";

export const todoWidget: WidgetDefinition<TodoConfig> = {
  type: "todo",
  displayName: "할 일",
  icon: ListChecks,
  category: "extended",
  defaultConfig: DEFAULT_TODO_CONFIG,
  defaultSize: { w: 6, h: 6 },
  minSize: { w: 4, h: 2 },
  maxSize: { w: 12, h: 16 },
  CompactView: TodoCompactView,
  ExpandedView: TodoExpandedView,
  ConfigEditor: TodoConfigEditor,
  copyBehavior: "config",
  dataMode: "static",
};

export default todoWidget;
export type { TodoConfig } from "./types";
