/**
 * sun-moon widget — config shape (일출·일몰 / 달 위상).
 *
 *  Stores ONE location (label + lat/lon). Sun times + moon phase are computed
 *  locally from the device clock (astro.ts) — no API. dataMode: 'static'.
 */
export interface SunMoonConfig {
  label: string;
  lat: number;
  lon: number;
}

/** Default location: 서울 시청. */
export const DEFAULT_SUN_MOON_CONFIG: SunMoonConfig = {
  label: "서울",
  lat: 37.5665,
  lon: 126.978,
};
