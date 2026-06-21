"use client";

/**
 * useWeather — poll /api/weather for one location (설계서 §2.1, dataMode:'poll').
 *
 *  Builds the request URL from THIS instance's config (lat/lon/label), so two
 *  weather widgets poll independently (격리). The payload is validated against
 *  WeatherSchema — types are IMPORTED from output/api-shapes.ts (Weather), never
 *  re-declared. Forecasts update on the order of an hour, so a 10-minute cadence
 *  keeps the tile fresh without hammering the upstream (the route also caches).
 */

import { WeatherSchema } from "@/output/api-shapes";
import { usePoll, type PollState } from "@/components/widgets/shared/usePoll";
import type { WeatherConfig } from "./types";

/** Poll cadence for weather (forecasts update hourly; auto-refresh every 30분). */
export const WEATHER_REFRESH_MS = 1_800_000;

export type WeatherState = PollState<typeof WeatherSchema._output>;

export function useWeather(config: WeatherConfig): WeatherState {
  const url = `/api/weather?lat=${encodeURIComponent(
    config.lat,
  )}&lon=${encodeURIComponent(config.lon)}&label=${encodeURIComponent(
    config.label,
  )}`;

  return usePoll(url, WeatherSchema, { intervalMs: WEATHER_REFRESH_MS });
}

export default useWeather;
