/**
 * sun-moon — WidgetDefinition (일출·일몰 / 달 위상). dataMode: 'static' (pure local
 * astronomy from the device clock). copyBehavior: 'config' (duplicate location).
 */

import { Sunrise } from "lucide-react";
import type { WidgetDefinition } from "@/lib/widgets/contract";
import { SunMoonCompactView } from "./CompactView";
import { SunMoonExpandedView } from "./ExpandedView";
import { SunMoonConfigEditor } from "./ConfigEditor";
import { DEFAULT_SUN_MOON_CONFIG, type SunMoonConfig } from "./types";

export const sunMoonWidget: WidgetDefinition<SunMoonConfig> = {
  type: "sun-moon",
  displayName: "일출·일몰/달",
  icon: Sunrise,
  category: "extended",
  defaultConfig: DEFAULT_SUN_MOON_CONFIG,
  defaultSize: { w: 6, h: 4 },
  minSize: { w: 4, h: 2 },
  maxSize: { w: 12, h: 12 },
  CompactView: SunMoonCompactView,
  ExpandedView: SunMoonExpandedView,
  ConfigEditor: SunMoonConfigEditor,
  copyBehavior: "config",
  dataMode: "static",
};

export default sunMoonWidget;
export type { SunMoonConfig } from "./types";
