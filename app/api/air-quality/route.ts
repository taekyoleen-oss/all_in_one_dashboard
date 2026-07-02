/**
 * ============================================================================
 *  GET /api/air-quality?lat=&lon=&label= — current pollutant levels (대기질)
 * ============================================================================
 *
 *  One location's current air quality (PM₂.₅/PM₁₀/O₃/NO₂/SO₂/CO + AQI). Source
 *  is the keyless Open-Meteo Air-Quality API, so it works today with no key.
 *  Validated against AirQualitySchema (output/api-shapes.ts — the anti-drift
 *  single source) before it leaves; the upstream is never thrown raw.
 *
 *  Caching: short shared TTL (30 min) — air quality updates hourly, so this
 *  shields the upstream from per-poll traffic.
 *
 *  Route Handler (Next.js 16). Reads the request URL → dynamic.
 * ============================================================================
 */

import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/api/requireUser";
import { fetchAirQuality } from "@/lib/api/airQualityClient";
import { AirQualitySchema, type AirQuality } from "@/output/api-shapes";

export const revalidate = 1800;

const CACHE_HEADERS = {
  "cache-control": "public, s-maxage=1800, stale-while-revalidate=3600",
} as const;

/** Default location when none/invalid given (서울 시청). */
const DEFAULT_LOCATION = { label: "서울", lat: 37.5665, lon: 126.978 };

function resolveLocation(searchParams: URLSearchParams): {
  label: string;
  lat: number;
  lon: number;
} {
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));
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
  return DEFAULT_LOCATION;
}

export async function GET(request: NextRequest) {
  // 인증 게이트 — 익명 호출로 upstream 소모 방지.
  const gate = await requireUser();
  if (gate) return gate;

  const { searchParams } = new URL(request.url);
  const loc = resolveLocation(searchParams);

  const air = await fetchAirQuality(loc.lat, loc.lon, loc.label);

  if (!air) {
    return Response.json(
      { error: "air_unavailable", message: "대기질 정보를 불러오지 못했습니다." },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }

  const parsed = AirQualitySchema.safeParse(air);
  const body: AirQuality = parsed.success ? parsed.data : air;

  return Response.json(body, { headers: CACHE_HEADERS });
}
