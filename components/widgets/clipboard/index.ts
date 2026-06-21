/**
 * clipboard — WidgetDefinition (클립보드 기록). dataMode:'static' (local; history
 * in localStorage per instance). copyBehavior:'custom' (clicking an entry copies
 * it back to the OS clipboard).
 */

import { ClipboardList } from "lucide-react";
import type { WidgetDefinition } from "@/lib/widgets/contract";
import { ClipboardCompactView } from "./CompactView";
import { ClipboardExpandedView } from "./ExpandedView";
import { ClipboardConfigEditor } from "./ConfigEditor";
import { DEFAULT_CLIPBOARD_CONFIG, type ClipboardConfig } from "./types";

export const clipboardWidget: WidgetDefinition<ClipboardConfig> = {
  type: "clipboard",
  displayName: "클립보드 기록",
  icon: ClipboardList,
  category: "extended",
  defaultConfig: DEFAULT_CLIPBOARD_CONFIG,
  defaultSize: { w: 6, h: 6 },
  minSize: { w: 4, h: 2 },
  maxSize: { w: 12, h: 16 },
  CompactView: ClipboardCompactView,
  ExpandedView: ClipboardExpandedView,
  ConfigEditor: ClipboardConfigEditor,
  copyBehavior: "custom",
  dataMode: "static",
};

export default clipboardWidget;
export type { ClipboardConfig } from "./types";
