/**
 * timer — WidgetDefinition (타이머 / 스톱워치 / 뽀모도로). dataMode: 'static'.
 * copyBehavior: 'config' (duplicate the preferences — the running state is
 * per-instance in localStorage, so a copy starts fresh).
 */

import { Timer } from "lucide-react";
import type { WidgetDefinition } from "@/lib/widgets/contract";
import { TimerCompactView } from "./CompactView";
import { TimerExpandedView } from "./ExpandedView";
import { TimerConfigEditor } from "./ConfigEditor";
import { DEFAULT_TIMER_CONFIG, type TimerConfig } from "./types";

export const timerWidget: WidgetDefinition<TimerConfig> = {
  type: "timer",
  displayName: "타이머",
  icon: Timer,
  category: "extended",
  defaultConfig: DEFAULT_TIMER_CONFIG,
  defaultSize: { w: 5, h: 6 },
  minSize: { w: 3, h: 4 },
  maxSize: { w: 10, h: 12 },
  CompactView: TimerCompactView,
  ExpandedView: TimerExpandedView,
  ConfigEditor: TimerConfigEditor,
  copyBehavior: "config",
  dataMode: "static",
};

export default timerWidget;
export type { TimerConfig } from "./types";
