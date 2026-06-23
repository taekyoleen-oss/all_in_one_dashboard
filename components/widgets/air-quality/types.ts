/**
 * air-quality widget — config shape (대기질·미세먼지).
 *
 *  Stores ONE location (label + lat/lon) — exactly like the weather widget. Air
 *  quality DATA never lives in config; live readings arrive from /api/air-quality
 *  (?lat=&lon=&label=). dataMode:'poll'.
 */
export interface AirQualityConfig {
  label: string;
  lat: number;
  lon: number;
}

/** Default location: 서울 시청 (mirrors the route's DEFAULT_LOCATION). */
export const DEFAULT_AIR_QUALITY_CONFIG: AirQualityConfig = {
  label: "서울",
  lat: 37.5665,
  lon: 126.978,
};
