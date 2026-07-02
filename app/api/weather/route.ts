/**
 * ============================================================================
 *  GET /api/weather?lat=&lon=  (or ?city=) — current + forecast (설계서 §2.1)
 * ============================================================================
 *
 *  One location's current conditions + a short hourly series + a daily forecast.
 *  Primary source is 기상청(KMA) 단기예보 when `KMA_API_KEY` is set (with the
 *  lat/lon→nx/ny grid conversion in lib/api/weatherClient.ts); the keyless
 *  fallback is Open-Meteo, so it works today with no key. Validated against
 *  WeatherSchema (output/api-shapes.ts — the anti-drift single source) before it
 *  leaves; the upstream is never thrown raw to the client.
 *
 *  Caching: short shared TTL (10 min) via Cache-Control — forecasts update on
 *  the order of an hour, so this shields the upstream from per-poll traffic.
 *
 *  Route Handler (Next.js 16). Reads the request URL → dynamic; caching via
 *  Cache-Control on the Response.
 * ============================================================================
 */

import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/api/requireUser";
import { fetchWeather } from "@/lib/api/weatherClient";
import { reverseGeocode } from "@/lib/api/geocodeClient";
import { WeatherSchema, type Weather } from "@/output/api-shapes";

export const revalidate = 600;

const CACHE_HEADERS = {
  "cache-control": "public, s-maxage=600, stale-while-revalidate=1200",
} as const;

/** Default location when none is given / a city can't be resolved (서울 시청). */
const DEFAULT_LOCATION = { label: "서울", lat: 37.5665, lon: 126.978 };

/**
 * A tiny keyless city catalog so `?city=` works today without a geocoding key.
 * Keys are lower-cased; both Korean and a few romanized aliases are accepted.
 * (When a geocoding key is added this can be replaced by a real lookup.)
 */
const CITY_CATALOG: Record<string, { label: string; lat: number; lon: number }> = {
  서울: { label: "서울", lat: 37.5665, lon: 126.978 },
  seoul: { label: "서울", lat: 37.5665, lon: 126.978 },
  부산: { label: "부산", lat: 35.1796, lon: 129.0756 },
  busan: { label: "부산", lat: 35.1796, lon: 129.0756 },
  인천: { label: "인천", lat: 37.4563, lon: 126.7052 },
  incheon: { label: "인천", lat: 37.4563, lon: 126.7052 },
  대구: { label: "대구", lat: 35.8714, lon: 128.6014 },
  daegu: { label: "대구", lat: 35.8714, lon: 128.6014 },
  대전: { label: "대전", lat: 36.3504, lon: 127.3845 },
  daejeon: { label: "대전", lat: 36.3504, lon: 127.3845 },
  광주: { label: "광주", lat: 35.1595, lon: 126.8526 },
  gwangju: { label: "광주", lat: 35.1595, lon: 126.8526 },
  울산: { label: "울산", lat: 35.5384, lon: 129.3114 },
  ulsan: { label: "울산", lat: 35.5384, lon: 129.3114 },
  세종: { label: "세종", lat: 36.48, lon: 127.289 },
  제주: { label: "제주", lat: 33.4996, lon: 126.5312 },
  jeju: { label: "제주", lat: 33.4996, lon: 126.5312 },
  수원: { label: "수원", lat: 37.2636, lon: 127.0286 },
  성남: { label: "성남", lat: 37.42, lon: 127.1265 },
  도쿄: { label: "도쿄", lat: 35.6762, lon: 139.6503 },
  tokyo: { label: "도쿄", lat: 35.6762, lon: 139.6503 },
  "뉴욕": { label: "뉴욕", lat: 40.7128, lon: -74.006 },
  "new york": { label: "뉴욕", lat: 40.7128, lon: -74.006 },
};

function resolveLocation(searchParams: URLSearchParams): {
  label: string;
  lat: number;
  lon: number;
} {
  const latRaw = searchParams.get("lat");
  const lonRaw = searchParams.get("lon");
  if (latRaw !== null && lonRaw !== null) {
    const lat = Number(latRaw);
    const lon = Number(lonRaw);
    if (
      Number.isFinite(lat) &&
      Number.isFinite(lon) &&
      lat >= -90 &&
      lat <= 90 &&
      lon >= -180 &&
      lon <= 180
    ) {
      const label = searchParams.get("label")?.trim() || "현재 위치";
      return { label, lat, lon };
    }
  }

  const city = searchParams.get("city")?.trim().toLowerCase();
  if (city && CITY_CATALOG[city]) return CITY_CATALOG[city];

  return DEFAULT_LOCATION;
}

export async function GET(request: NextRequest) {
  // 인증 게이트 — 익명 호출로 유료 upstream(KMA·Kakao 역지오코딩) 소모 방지.
  const gate = await requireUser();
  if (gate) return gate;

  const { searchParams } = new URL(request.url);
  const loc = resolveLocation(searchParams);

  // 날씨와 동(행정동) 역지오코딩을 병렬로 — 동은 best-effort(요구: 실제 동까지 표시).
  // 실패하거나 KR 밖이면 dong 없이 기존 라벨을 유지. 응답은 s-maxage로 캐시(10분)되어
  // 위치당 호출 빈도가 낮다.
  const [weather, rev] = await Promise.all([
    fetchWeather(loc.lat, loc.lon, loc.label),
    reverseGeocode(loc.lat, loc.lon).catch(() => null),
  ]);

  if (!weather) {
    return Response.json(
      { error: "weather_unavailable", message: "날씨 정보를 불러오지 못했습니다." },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }

  const parsed = WeatherSchema.safeParse(weather);
  const body: Weather = parsed.success ? parsed.data : weather;
  if (rev?.label) body.location = { ...body.location, dong: rev.label };

  return Response.json(body, { headers: CACHE_HEADERS });
}
