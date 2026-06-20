/**
 * weather widget — config shape (설계서 §2.1 "날씨").
 *
 *  The widget stores ONE location (a label + lat/lon). Weather DATA never lives
 *  in config — only the location does; live conditions arrive from /api/weather
 *  (?lat=&lon=&label=). dataMode:'poll'.
 *
 *  Location can be set two ways in the ConfigEditor: "현재 위치"
 *  (navigator.geolocation → lat/lon) or a city pick / manual lat-lon entry. The
 *  default is 서울 시청 (matching the route's DEFAULT_LOCATION) so a fresh widget
 *  renders without any setup.
 */

export interface WeatherConfig {
  /** Display name for the location (e.g. "서울", "현재 위치"). */
  label: string;
  /** Latitude, degrees (-90..90). */
  lat: number;
  /** Longitude, degrees (-180..180). */
  lon: number;
}

/** Default location: 서울 시청 (mirrors the /api/weather DEFAULT_LOCATION). */
export const DEFAULT_WEATHER_CONFIG: WeatherConfig = {
  label: "서울",
  lat: 37.5665,
  lon: 126.978,
};

/** A small curated city catalog for the picker (mirrors the route's catalog). */
export const COMMON_CITIES: WeatherConfig[] = [
  { label: "서울", lat: 37.5665, lon: 126.978 },
  { label: "부산", lat: 35.1796, lon: 129.0756 },
  { label: "인천", lat: 37.4563, lon: 126.7052 },
  { label: "대구", lat: 35.8714, lon: 128.6014 },
  { label: "대전", lat: 36.3504, lon: 127.3845 },
  { label: "광주", lat: 35.1595, lon: 126.8526 },
  { label: "울산", lat: 35.5384, lon: 129.3114 },
  { label: "제주", lat: 33.4996, lon: 126.5312 },
  { label: "도쿄", lat: 35.6762, lon: 139.6503 },
  { label: "뉴욕", lat: 40.7128, lon: -74.006 },
];
