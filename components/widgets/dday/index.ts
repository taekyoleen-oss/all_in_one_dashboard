/**
 * dday — WidgetDefinition (설계서 §2.2). dataMode: 'static' (computed locally
 * with date-fns). copyBehavior: 'config' (duplicate the entry list).
 */

import { CalendarClock } from "lucide-react";
import type { WidgetDefinition } from "@/lib/widgets/contract";
import { DDayCompactView } from "./CompactView";
import { DDayExpandedView } from "./ExpandedView";
import { DDayConfigEditor } from "./ConfigEditor";
import { DEFAULT_DDAY_CONFIG, type DDayConfig } from "./types";

export const ddayWidget: WidgetDefinition<DDayConfig> = {
  type: "dday",
  displayName: "D-Day",
  icon: CalendarClock,
  category: "extended",
  defaultConfig: DEFAULT_DDAY_CONFIG,
  defaultSize: { w: 3, h: 2 },
  minSize: { w: 2, h: 1 },
  maxSize: { w: 6, h: 6 },
  CompactView: DDayCompactView,
  ExpandedView: DDayExpandedView,
  ConfigEditor: DDayConfigEditor,
  copyBehavior: "config",
  dataMode: "static",
};

export default ddayWidget;
export type { DDayConfig } from "./types";
