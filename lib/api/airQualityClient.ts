/**
 * ============================================================================
 *  Air-quality client — keyless Open-Meteo Air-Quality API (대기질·미세먼지)
 * ============================================================================
 *
 *  SERVER-ONLY. Normalizes pollutant data into the shared `AirQuality` shape
 *  (output/api-shapes.ts — the anti-drift single source).
 *
 *    • SOURCE : the **keyless** Open-Meteo Air-Quality API — works today, no key.
 *      Returns PM₂.₅/PM₁₀/O₃/NO₂/SO₂/CO (µg/m³) plus European/US AQI indices.
 *
 *  Korean grading (좋음/보통/나쁨/매우나쁨) is computed in the widget from the raw
 *  PM concentrations, so this client only normalizes the numbers. The route
 *  caches (short TTL) and never throws raw upstream errors to the client.
 * ============================================================================
 */

// SERVER-ONLY: imported only from app/api/air-quality/route.ts.
import type { AirQuality } from "@/output/api-shapes";

const FETCH_TIMEOUT_MS = 9_000;

const OPEN_METEO_AQ_BASE =
  "https://air-quality-api.open-meteo.com/v1/air-quality";

interface OpenMeteoAqResponse {
  current?: {
    time?: string;
    pm2_5?: number;
    pm10?: number;
    ozone?: number;
    nitrogen_dioxide?: number;
    sulphur_dioxide?: number;
    carbon_monoxide?: number;
    european_aqi?: number;
    us_aqi?: number;
  };
}

function optNum(v: number | undefined): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/**
 * Fetch current air quality for a location → normalized `AirQuality`. Returns
 * null on any failure (the route maps null to a typed error).
 */
export async function fetchAirQuality(
  lat: number,
  lon: number,
  label: string,
): Promise<AirQuality | null> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current:
      "pm2_5,pm10,ozone,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide,european_aqi,us_aqi",
    timezone: "auto",
    // The CAMS European model has the best resolution over Korea/Asia too,
    // but `auto` lets Open-Meteo pick the best domain for the coordinates.
    domains: "auto",
  });
  const url = `${OPEN_METEO_AQ_BASE}?${params.toString()}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as OpenMeteoAqResponse;
    const cur = json.current;
    if (!cur) return null;

    const now = Date.now();
    const observedAt = cur.time ? Date.parse(cur.time) : now;

    return {
      location: { label, lat, lon },
      current: {
        pm25: optNum(cur.pm2_5),
        pm10: optNum(cur.pm10),
        o3: optNum(cur.ozone),
        no2: optNum(cur.nitrogen_dioxide),
        so2: optNum(cur.sulphur_dioxide),
        co: optNum(cur.carbon_monoxide),
        euAqi: optNum(cur.european_aqi),
        usAqi: optNum(cur.us_aqi),
      },
      observedAt: Number.isNaN(observedAt) ? now : observedAt,
      provider: "open-meteo",
      stale: true,
      ts: now,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
