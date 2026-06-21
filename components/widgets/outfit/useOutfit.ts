"use client";

/**
 * useOutfit — /api/weather 폴링 (외출옷 추천 위젯, dataMode:'poll').
 *
 *  위치(lat/lon)별로 독립 폴링(격리). 날씨 페이로드는 WeatherSchema로 검증하고,
 *  추천/일러스트 계산은 뷰에서 선택 시간대에 따라 buildOutfitSnapshot+recommendOutfit으로
 *  파생한다(날씨 위젯과 동일하게 데이터는 여기서만, 가공은 뷰에서).
 */

import { WeatherSchema } from "@/output/api-shapes";
import { usePoll, type PollState } from "@/components/widgets/shared/usePoll";
import type { OutfitConfig } from "./types";

/** 폴링 주기 — 예보는 시간 단위 갱신이므로 30분(날씨 위젯과 동일). */
export const OUTFIT_REFRESH_MS = 1_800_000;

export type OutfitWeatherState = PollState<typeof WeatherSchema._output>;

export function useOutfit(config: OutfitConfig): OutfitWeatherState {
  const url = `/api/weather?lat=${encodeURIComponent(
    config.lat,
  )}&lon=${encodeURIComponent(config.lon)}&label=${encodeURIComponent(
    config.label,
  )}`;
  return usePoll(url, WeatherSchema, { intervalMs: OUTFIT_REFRESH_MS });
}

export default useOutfit;
