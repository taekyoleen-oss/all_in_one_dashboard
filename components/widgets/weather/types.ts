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

/** Which forecast the tile (CompactView) shows. ExpandedView always shows all. */
export type WeatherView = "current" | "hourly" | "daily";

/** 시간별·주간 목록을 가로 줄(strip) 또는 세로 목록으로 표시. */
export type WeatherLayout = "horizontal" | "vertical";

export interface WeatherConfig {
  /** Display name for the location (e.g. "서울", "현재 위치"). */
  label: string;
  /** Latitude, degrees (-90..90). */
  lat: number;
  /** Longitude, degrees (-180..180). */
  lon: number;
  /**
   * Tile view: 현재(current) · 시간별(hourly) · 주간(daily). Optional for
   * backward-compat — undefined behaves as "current".
   */
  view?: WeatherView;
  /** 시간별 표시 방향(가로/세로). 미설정=가로(기존 동작). 타일·자세히 모두 적용. */
  hourlyLayout?: WeatherLayout;
  /** 주간 표시 방향(가로/세로). 미설정=가로(기존 동작). 타일·자세히 모두 적용. */
  dailyLayout?: WeatherLayout;
}

/** Default location: 서울 시청 (mirrors the /api/weather DEFAULT_LOCATION). */
export const DEFAULT_WEATHER_CONFIG: WeatherConfig = {
  label: "서울",
  lat: 37.5665,
  lon: 126.978,
  view: "current",
};

/** Picker locations — selectable cities (구/도 단위) so 지역 선택이 폭넓게 동작한다.
 *  그 외 지역은 ConfigEditor의 '직접 입력'(위도/경도) 또는 '현재 위치'로 설정. */
export const COMMON_CITIES: Array<{ label: string; lat: number; lon: number }> = [
  { label: "서울", lat: 37.5665, lon: 126.978 },
  { label: "부산", lat: 35.1796, lon: 129.0756 },
  { label: "인천", lat: 37.4563, lon: 126.7052 },
  { label: "대구", lat: 35.8714, lon: 128.6014 },
  { label: "대전", lat: 36.3504, lon: 127.3845 },
  { label: "광주", lat: 35.1595, lon: 126.8526 },
  { label: "울산", lat: 35.5384, lon: 129.3114 },
  { label: "세종", lat: 36.48, lon: 127.289 },
  { label: "수원", lat: 37.2636, lon: 127.0286 },
  { label: "용인", lat: 37.2411, lon: 127.1776 },
  { label: "성남", lat: 37.4201, lon: 127.1262 },
  { label: "고양", lat: 37.6584, lon: 126.832 },
  { label: "춘천", lat: 37.8813, lon: 127.7298 },
  { label: "강릉", lat: 37.7519, lon: 128.8761 },
  { label: "원주", lat: 37.3422, lon: 127.9202 },
  { label: "청주", lat: 36.6424, lon: 127.489 },
  { label: "충주", lat: 36.991, lon: 127.926 },
  { label: "천안", lat: 36.8151, lon: 127.1139 },
  { label: "전주", lat: 35.8242, lon: 127.148 },
  { label: "군산", lat: 35.9676, lon: 126.7369 },
  { label: "목포", lat: 34.8118, lon: 126.3922 },
  { label: "여수", lat: 34.7604, lon: 127.6622 },
  { label: "순천", lat: 34.9506, lon: 127.4872 },
  { label: "포항", lat: 36.019, lon: 129.3435 },
  { label: "경주", lat: 35.8562, lon: 129.2247 },
  { label: "안동", lat: 36.5684, lon: 128.7294 },
  { label: "구미", lat: 36.1196, lon: 128.3445 },
  { label: "창원", lat: 35.2278, lon: 128.6817 },
  { label: "진주", lat: 35.1799, lon: 128.1076 },
  { label: "제주", lat: 33.4996, lon: 126.5312 },
  { label: "서귀포", lat: 33.2541, lon: 126.56 },
  { label: "도쿄", lat: 35.6762, lon: 139.6503 },
  { label: "뉴욕", lat: 40.7128, lon: -74.006 },
];
