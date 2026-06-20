/**
 * world-clock — WidgetDefinition (설계서 §2.2). dataMode: 'static' (client-only
 * IANA timezones via Intl, no external API). copyBehavior: 'config' (duplicate
 * the zone list + display options).
 */

import { Clock } from "lucide-react";
import type { WidgetDefinition } from "@/lib/widgets/contract";
import { WorldClockCompactView } from "./CompactView";
import { WorldClockExpandedView } from "./ExpandedView";
import { WorldClockConfigEditor } from "./ConfigEditor";
import { DEFAULT_WORLD_CLOCK_CONFIG, type WorldClockConfig } from "./types";

export const worldClockWidget: WidgetDefinition<WorldClockConfig> = {
  type: "world-clock",
  displayName: "세계시계",
  icon: Clock,
  category: "extended",
  defaultConfig: DEFAULT_WORLD_CLOCK_CONFIG,
  defaultSize: { w: 3, h: 3 },
  minSize: { w: 2, h: 2 },
  maxSize: { w: 6, h: 6 },
  CompactView: WorldClockCompactView,
  ExpandedView: WorldClockExpandedView,
  ConfigEditor: WorldClockConfigEditor,
  copyBehavior: "config",
  dataMode: "static",
};

export default worldClockWidget;
export type { WorldClockConfig } from "./types";
