/**
 * air-quality — WidgetDefinition (대기질·미세먼지). dataMode: 'poll' (snapshot from
 * /api/air-quality — keyless Open-Meteo Air-Quality). copyBehavior: 'config'
 * (duplicate the location).
 *
 *  All air-quality types are IMPORTED from output/api-shapes.ts (the anti-drift
 *  single source) via the hook/views — never re-declared here.
 */

import { Wind } from "lucide-react";
import type { WidgetDefinition } from "@/lib/widgets/contract";
import { AirQualityCompactView } from "./CompactView";
import { AirQualityExpandedView } from "./ExpandedView";
import { AirQualityConfigEditor } from "./ConfigEditor";
import { AIR_REFRESH_MS } from "./useAirQuality";
import { DEFAULT_AIR_QUALITY_CONFIG, type AirQualityConfig } from "./types";

export const airQualityWidget: WidgetDefinition<AirQualityConfig> = {
  type: "air-quality",
  displayName: "대기질",
  icon: Wind,
  category: "extended",
  defaultConfig: DEFAULT_AIR_QUALITY_CONFIG,
  defaultSize: { w: 6, h: 6 },
  minSize: { w: 4, h: 2 },
  maxSize: { w: 12, h: 16 },
  CompactView: AirQualityCompactView,
  ExpandedView: AirQualityExpandedView,
  ConfigEditor: AirQualityConfigEditor,
  copyBehavior: "config",
  dataMode: "poll",
  refreshInterval: AIR_REFRESH_MS,
};

export default airQualityWidget;
export type { AirQualityConfig } from "./types";
