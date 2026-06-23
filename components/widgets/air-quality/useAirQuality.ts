"use client";

/**
 * useAirQuality — poll /api/air-quality for one location (dataMode:'poll').
 *
 *  Builds the request URL from THIS instance's config (lat/lon/label) so two
 *  widgets poll independently (격리). The payload is validated against
 *  AirQualitySchema — types are IMPORTED from output/api-shapes.ts (AirQuality),
 *  never re-declared. Air quality updates hourly, so a 30-minute cadence keeps
 *  the tile fresh without hammering the upstream (the route also caches).
 */

import { AirQualitySchema } from "@/output/api-shapes";
import { usePoll, type PollState } from "@/components/widgets/shared/usePoll";
import type { AirQualityConfig } from "./types";

export const AIR_REFRESH_MS = 1_800_000;

export type AirQualityState = PollState<typeof AirQualitySchema._output>;

export function useAirQuality(config: AirQualityConfig): AirQualityState {
  const url = `/api/air-quality?lat=${encodeURIComponent(
    config.lat,
  )}&lon=${encodeURIComponent(config.lon)}&label=${encodeURIComponent(
    config.label,
  )}`;
  return usePoll(url, AirQualitySchema, { intervalMs: AIR_REFRESH_MS });
}

export default useAirQuality;
