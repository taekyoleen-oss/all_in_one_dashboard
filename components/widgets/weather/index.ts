/**
 * weather — WidgetDefinition (설계서 §2.1 "날씨"). dataMode: 'poll' (snapshot from
 * /api/weather — KMA primary, keyless Open-Meteo fallback). copyBehavior:
 * 'config' (duplicate the location).
 *
 *  All weather types are IMPORTED from output/api-shapes.ts (the anti-drift
 *  single source) via the hook/views — never re-declared here.
 */

import { CloudSun } from "lucide-react";
import type { WidgetDefinition } from "@/lib/widgets/contract";
import { WeatherCompactView } from "./CompactView";
import { WeatherExpandedView } from "./ExpandedView";
import { WeatherConfigEditor } from "./ConfigEditor";
import { WEATHER_REFRESH_MS } from "./useWeather";
import { DEFAULT_WEATHER_CONFIG, type WeatherConfig } from "./types";

export const weatherWidget: WidgetDefinition<WeatherConfig> = {
  type: "weather",
  displayName: "날씨",
  icon: CloudSun,
  category: "core",
  defaultConfig: DEFAULT_WEATHER_CONFIG,
  defaultSize: { w: 3, h: 3 },
  minSize: { w: 2, h: 2 },
  maxSize: { w: 6, h: 8 },
  CompactView: WeatherCompactView,
  ExpandedView: WeatherExpandedView,
  ConfigEditor: WeatherConfigEditor,
  copyBehavior: "config",
  dataMode: "poll",
  refreshInterval: WEATHER_REFRESH_MS,
};

export default weatherWidget;
export type { WeatherConfig } from "./types";
