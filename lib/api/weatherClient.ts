/**
 * ============================================================================
 *  Weather client — KMA primary + Open-Meteo keyless fallback (설계서 §2.1, §11.1)
 * ============================================================================
 *
 *  SERVER-ONLY. Normalizes weather data into the shared `Weather` shape
 *  (output/api-shapes.ts — the anti-drift single source).
 *
 *    • PRIMARY  : 기상청(KMA) 단기예보 (VilageFcst). Needs `KMA_API_KEY` AND a
 *      lat/lon → nx/ny grid conversion (the standard KMA DFS Lambert Conformal
 *      Conic algorithm — implemented below). Used only when the key is present.
 *    • FALLBACK : the **keyless** Open-Meteo forecast API — works today, no key.
 *
 *  Both paths produce the SAME normalized shape (current + hourly + daily) so
 *  the widget renders one shape regardless of source. `condition` is mapped to a
 *  small source-neutral enum (icon + label — never color-only). Temps are °C,
 *  times epoch ms. The route caches (short TTL) and never throws raw upstream.
 * ============================================================================
 */

// SERVER-ONLY: imported only from app/api/weather/route.ts. KMA_API_KEY (when
// present) is read here and never serialized to the client.
import type {
  Weather,
  WeatherCondition,
  WeatherDay,
  WeatherHour,
} from "@/output/api-shapes";

const FETCH_TIMEOUT_MS = 9_000;

/* ---------------------------------------------------------------------------
 *  KMA DFS grid conversion — lat/lon ⇄ nx/ny (Lambert Conformal Conic)
 *  The canonical constants published by 기상청 for the 단기예보 5km grid.
 * ------------------------------------------------------------------------- */

const DFS = {
  RE: 6371.00877, // Earth radius (km)
  GRID: 5.0, // grid spacing (km)
  SLAT1: 30.0, // standard latitude 1 (deg)
  SLAT2: 60.0, // standard latitude 2 (deg)
  OLON: 126.0, // origin longitude (deg)
  OLAT: 38.0, // origin latitude (deg)
  XO: 43, // origin X grid point
  YO: 136, // origin Y grid point
} as const;

export interface Grid {
  nx: number;
  ny: number;
}

/** Convert geographic lat/lon (degrees) to KMA forecast grid (nx, ny). */
export function latLonToGrid(lat: number, lon: number): Grid {
  const DEGRAD = Math.PI / 180.0;
  const re = DFS.RE / DFS.GRID;
  const slat1 = DFS.SLAT1 * DEGRAD;
  const slat2 = DFS.SLAT2 * DEGRAD;
  const olon = DFS.OLON * DEGRAD;
  const olat = DFS.OLAT * DEGRAD;

  let sn =
    Math.tan(Math.PI * 0.25 + slat2 * 0.5) /
    Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = (re * sf) / Math.pow(ro, sn);

  let ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5);
  ra = (re * sf) / Math.pow(ra, sn);
  let theta = lon * DEGRAD - olon;
  if (theta > Math.PI) theta -= 2.0 * Math.PI;
  if (theta < -Math.PI) theta += 2.0 * Math.PI;
  theta *= sn;

  const nx = Math.floor(ra * Math.sin(theta) + DFS.XO + 0.5);
  const ny = Math.floor(ro - ra * Math.cos(theta) + DFS.YO + 0.5);
  return { nx, ny };
}

/* ---------------------------------------------------------------------------
 *  Open-Meteo (keyless fallback) — WMO weather codes → our condition enum
 * ------------------------------------------------------------------------- */

const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast";

/** Map a WMO weather-interpretation code to our source-neutral condition. */
export function wmoToCondition(code: number): WeatherCondition {
  if (code === 0) return "clear";
  if (code === 1 || code === 2) return "partly-cloudy";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "rain"; // drizzle
  if (code >= 61 && code <= 65) return "rain";
  if (code === 66 || code === 67) return "sleet"; // freezing rain
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 80 && code <= 82) return "rain"; // rain showers
  if (code === 85 || code === 86) return "snow"; // snow showers
  if (code >= 95) return "thunderstorm";
  return "unknown";
}

interface OpenMeteoResponse {
  /** Seconds the location's local time is ahead of UTC (from `timezone=auto`). */
  utc_offset_seconds?: number;
  current?: {
    time?: string;
    temperature_2m?: number;
    apparent_temperature?: number;
    relative_humidity_2m?: number;
    wind_speed_10m?: number;
    weather_code?: number;
    precipitation_probability?: number;
  };
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    weather_code?: number[];
    precipitation_probability?: number[];
  };
  daily?: {
    time?: string[];
    temperature_2m_min?: number[];
    temperature_2m_max?: number[];
    weather_code?: number[];
    precipitation_probability_max?: number[];
  };
}

/** How many hours of the hourly series to keep (from "now" forward).
 *  48h(=약 2일): 외출옷 위젯이 오후에도 '내일' 전 시간대(저녁 포함)를 예보로 잡을 수 있게
 *  한다(24h면 오후엔 내일 저녁이 빠짐). 날씨 위젯은 hourly.slice(0,12)만 표시하므로 영향 없음. */
const HOURLY_KEEP = 48;
/** How many days of the daily forecast to keep. */
const DAILY_KEEP = 7;

/**
 * Keyless fallback: Open-Meteo forecast → normalized `Weather`. Returns null on
 * any failure (the route maps null to a typed error).
 */
export async function fetchOpenMeteo(
  lat: number,
  lon: number,
  label: string,
): Promise<Weather | null> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current:
      "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,precipitation_probability",
    hourly: "temperature_2m,weather_code,precipitation_probability",
    daily:
      "temperature_2m_min,temperature_2m_max,weather_code,precipitation_probability_max",
    timezone: "auto",
    forecast_days: "7",
    // 어제 같은 시각 기온을 얻기 위해 과거 1일을 포함(hourly 에 어제치가 들어온다).
    past_days: "1",
    wind_speed_unit: "ms",
  });
  const url = `${OPEN_METEO_BASE}?${params.toString()}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as OpenMeteoResponse;
    const cur = json.current;
    if (!cur || typeof cur.temperature_2m !== "number") return null;

    const now = Date.now();
    // `timezone=auto` returns LOCAL wall-clock strings with NO offset suffix, so
    // Date.parse() would read them in the SERVER's timezone (e.g. UTC on Vercel),
    // shifting every point by the zone offset (KST → +9h). That made the hourly
    // strip render forecast points ~9h in the past (dawn temps → "too low").
    // Convert with the response's utc_offset_seconds → a correct UTC instant,
    // independent of where the server runs.
    const offsetSec = numOr(json.utc_offset_seconds, 0);

    // ---- hourly: keep the next HOURLY_KEEP points from "now" ----
    // past_days=1 prepends YESTERDAY's hours; we use them only for the "어제 대비"
    // temp (closest hour to now-24h), then keep just the forward points for display.
    const hourly: WeatherHour[] = [];
    const ht = json.hourly?.time ?? [];
    const htemp = json.hourly?.temperature_2m ?? [];
    const hcode = json.hourly?.weather_code ?? [];
    const hpop = json.hourly?.precipitation_probability ?? [];
    const yTarget = now - 86_400_000; // 24h ago
    let yTemp: number | undefined;
    let yBestDelta = Infinity;
    for (let i = 0; i < ht.length; i++) {
      const ts = localTimeToEpoch(ht[i], offsetSec);
      if (Number.isNaN(ts)) continue;
      // Track the past hour nearest to "same time yesterday" for the 어제 대비 line.
      const t = optNum(htemp[i]);
      if (t !== undefined) {
        const d = Math.abs(ts - yTarget);
        if (d < yBestDelta) {
          yBestDelta = d;
          yTemp = t;
        }
      }
      if (ts < now - 3_600_000) continue; // drop hours already well past
      hourly.push({
        ts,
        temp: numOr(htemp[i], 0),
        condition: wmoToCondition(numOr(hcode[i], -1)),
        pop: optNum(hpop[i]),
      });
      if (hourly.length >= HOURLY_KEEP) break;
    }
    // Only trust the match if it's within ~90min of the target hour.
    const tempYesterday = yBestDelta <= 5_400_000 ? yTemp : undefined;

    // ---- daily ----
    const daily: WeatherDay[] = [];
    const dt = json.daily?.time ?? [];
    const dmin = json.daily?.temperature_2m_min ?? [];
    const dmax = json.daily?.temperature_2m_max ?? [];
    const dcode = json.daily?.weather_code ?? [];
    const dpop = json.daily?.precipitation_probability_max ?? [];
    for (let i = 0; i < dt.length && daily.length < DAILY_KEEP; i++) {
      daily.push({
        date: dt[i],
        tempMin: numOr(dmin[i], 0),
        tempMax: numOr(dmax[i], 0),
        condition: wmoToCondition(numOr(dcode[i], -1)),
        pop: optNum(dpop[i]),
      });
    }

    return {
      location: { label, lat, lon },
      current: {
        temp: cur.temperature_2m,
        feelsLike: optNum(cur.apparent_temperature),
        condition: wmoToCondition(numOr(cur.weather_code, -1)),
        humidity: optNum(cur.relative_humidity_2m),
        windSpeed: optNum(cur.wind_speed_10m),
        pop: optNum(cur.precipitation_probability),
        tempYesterday,
        ts: cur.time ? orNow(localTimeToEpoch(cur.time, offsetSec)) : now,
      },
      hourly,
      daily,
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

/* ---------------------------------------------------------------------------
 *  KMA 단기예보 (primary, keyed) — VilageFcst short-term forecast
 * ------------------------------------------------------------------------- */

const KMA_BASE =
  "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst";

/** True iff KMA_API_KEY is present + non-empty. */
export function hasKmaKey(): boolean {
  return Boolean(process.env.KMA_API_KEY?.trim());
}

/** KMA category → our condition (PTY precip type wins over SKY sky state). */
function kmaCondition(sky: number | undefined, pty: number | undefined): WeatherCondition {
  // PTY: 0 없음, 1 비, 2 비/눈, 3 눈, 4 소나기 (단기예보)
  if (pty !== undefined && pty > 0) {
    if (pty === 1 || pty === 4) return "rain";
    if (pty === 2) return "sleet";
    if (pty === 3) return "snow";
  }
  // SKY: 1 맑음, 3 구름많음, 4 흐림
  if (sky === 1) return "clear";
  if (sky === 3) return "partly-cloudy";
  if (sky === 4) return "cloudy";
  return "unknown";
}

/** Compute the most recent KMA base_date/base_time (KST), per the 8 publish slots. */
export function kmaBaseDateTime(at: Date = new Date()): {
  baseDate: string;
  baseTime: string;
} {
  // KMA publishes at 02,05,08,11,14,17,20,23 (KST); data ready ~10min after.
  const slots = [2, 5, 8, 11, 14, 17, 20, 23];
  // Work in KST (UTC+9) regardless of server timezone.
  const kst = new Date(at.getTime() + 9 * 3_600_000);
  let y = kst.getUTCFullYear();
  let m = kst.getUTCMonth();
  let d = kst.getUTCDate();
  const hour = kst.getUTCHours();
  const minute = kst.getUTCMinutes();

  // Pick the latest slot whose publish time + 10min buffer has passed.
  let chosen = -1;
  for (const s of slots) {
    if (hour > s || (hour === s && minute >= 10)) chosen = s;
  }
  if (chosen === -1) {
    // Before 02:10 KST → use 23:00 of the previous day.
    const prev = new Date(Date.UTC(y, m, d) - 24 * 3_600_000);
    y = prev.getUTCFullYear();
    m = prev.getUTCMonth();
    d = prev.getUTCDate();
    chosen = 23;
  }
  const baseDate = `${y}${pad2(m + 1)}${pad2(d)}`;
  const baseTime = `${pad2(chosen)}00`;
  return { baseDate, baseTime };
}

interface KmaItem {
  category: string; // TMP, SKY, PTY, POP, REH, WSD, TMN, TMX …
  fcstDate: string; // yyyymmdd
  fcstTime: string; // HHmm
  fcstValue: string;
}

interface KmaResponse {
  response?: {
    header?: { resultCode?: string; resultMsg?: string };
    body?: { items?: { item?: KmaItem[] } };
  };
}

/**
 * Primary KMA path → normalized `Weather`. Returns null on any failure so the
 * route can fall through to the keyless source.
 */
export async function fetchKma(
  lat: number,
  lon: number,
  label: string,
): Promise<Weather | null> {
  const key = process.env.KMA_API_KEY?.trim();
  if (!key) return null;

  const { nx, ny } = latLonToGrid(lat, lon);
  const { baseDate, baseTime } = kmaBaseDateTime();
  const params = new URLSearchParams({
    serviceKey: key, // data.go.kr keys are pre-encoded; URLSearchParams encodes safely.
    pageNo: "1",
    numOfRows: "1000",
    dataType: "JSON",
    base_date: baseDate,
    base_time: baseTime,
    nx: String(nx),
    ny: String(ny),
  });
  const url = `${KMA_BASE}?${params.toString()}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as KmaResponse;
    if (json.response?.header?.resultCode !== "00") return null;
    const items = json.response?.body?.items?.item;
    if (!items || items.length === 0) return null;

    return normalizeKma(items, lat, lon, label);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Fold KMA's flat per-category items into our current/hourly/daily shape. */
function normalizeKma(
  items: KmaItem[],
  lat: number,
  lon: number,
  label: string,
): Weather | null {
  // Group values by fcstDate+fcstTime → { category: value }.
  const slots = new Map<string, Record<string, string>>();
  // Daily TMN/TMX live on specific times; collect per date.
  const dayMin = new Map<string, number>();
  const dayMax = new Map<string, number>();

  for (const it of items) {
    const key = `${it.fcstDate}${it.fcstTime}`;
    const bucket = slots.get(key) ?? {};
    bucket[it.category] = it.fcstValue;
    slots.set(key, bucket);
    if (it.category === "TMN") dayMin.set(it.fcstDate, Number(it.fcstValue));
    if (it.category === "TMX") dayMax.set(it.fcstDate, Number(it.fcstValue));
  }

  const sortedKeys = [...slots.keys()].sort();
  if (sortedKeys.length === 0) return null;

  const hourly: WeatherHour[] = [];
  for (const k of sortedKeys) {
    const b = slots.get(k)!;
    if (b.TMP === undefined) continue; // only hourly temp slots
    const ts = kstSlotToEpoch(k);
    hourly.push({
      ts,
      temp: Number(b.TMP),
      condition: kmaCondition(numFrom(b.SKY), numFrom(b.PTY)),
      pop: optNumFrom(b.POP),
    });
    if (hourly.length >= HOURLY_KEEP) break;
  }
  if (hourly.length === 0) return null;

  // Current = the first hourly slot (nearest forecast hour). Enrich with REH/WSD.
  const firstKey = sortedKeys.find((k) => slots.get(k)?.TMP !== undefined)!;
  const firstBucket = slots.get(firstKey)!;
  const current = {
    temp: Number(firstBucket.TMP),
    condition: kmaCondition(numFrom(firstBucket.SKY), numFrom(firstBucket.PTY)),
    humidity: optNumFrom(firstBucket.REH),
    windSpeed: optNumFrom(firstBucket.WSD),
    pop: optNumFrom(firstBucket.POP),
    ts: kstSlotToEpoch(firstKey),
  };

  // Daily: min/max per date, condition from a midday slot if available.
  const daily: WeatherDay[] = [];
  const dates = [...new Set(sortedKeys.map((k) => k.slice(0, 8)))].sort();
  for (const date of dates.slice(0, DAILY_KEEP)) {
    const min = dayMin.get(date);
    const max = dayMax.get(date);
    // Pick a representative condition from the 15:00 slot, else the first slot of the day.
    const repKey =
      sortedKeys.find((k) => k.startsWith(date) && k.endsWith("1500")) ??
      sortedKeys.find((k) => k.startsWith(date));
    const rep = repKey ? slots.get(repKey) : undefined;
    if (min === undefined && max === undefined) continue;
    daily.push({
      date: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`,
      tempMin: min ?? max ?? 0,
      tempMax: max ?? min ?? 0,
      condition: rep
        ? kmaCondition(numFrom(rep.SKY), numFrom(rep.PTY))
        : "unknown",
      pop: rep ? optNumFrom(rep.POP) : undefined,
    });
  }

  return {
    location: { label, lat, lon },
    current,
    hourly,
    daily,
    provider: "kma",
    stale: false,
    ts: Date.now(),
  };
}

/* ---------------------------------------------------------------------------
 *  small helpers
 * ------------------------------------------------------------------------- */

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Convert an Open-Meteo `timezone=auto` local wall-clock string ("YYYY-MM-DDTHH:mm",
 * no offset) to a true UTC epoch (ms) using the response's utc_offset_seconds.
 * Parses the components as if UTC, then subtracts the zone offset — so the instant
 * is correct regardless of the SERVER's own timezone. Returns NaN on a bad string.
 */
function localTimeToEpoch(local: string | undefined, offsetSec: number): number {
  if (!local) return NaN;
  const asUtc = Date.parse(`${local}Z`);
  if (Number.isNaN(asUtc)) return NaN;
  return asUtc - offsetSec * 1000;
}

/** "yyyymmddHHmm" (KST) → epoch ms. */
function kstSlotToEpoch(key: string): number {
  const y = Number(key.slice(0, 4));
  const mo = Number(key.slice(4, 6));
  const d = Number(key.slice(6, 8));
  const h = Number(key.slice(8, 10));
  const mi = Number(key.slice(10, 12));
  // The slot is KST (UTC+9): build the UTC instant by subtracting 9h.
  return Date.UTC(y, mo - 1, d, h, mi) - 9 * 3_600_000;
}

function numOr(v: number | undefined, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function optNum(v: number | undefined): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function numFrom(v: string | undefined): number | undefined {
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function optNumFrom(v: string | undefined): number | undefined {
  return numFrom(v);
}

function orNow(ts: number): number {
  return Number.isNaN(ts) ? Date.now() : ts;
}

/* ---------------------------------------------------------------------------
 *  Public entry: try KMA (if keyed) → Open-Meteo fallback → null
 * ------------------------------------------------------------------------- */

export async function fetchWeather(
  lat: number,
  lon: number,
  label: string,
): Promise<Weather | null> {
  if (hasKmaKey()) {
    const kma = await fetchKma(lat, lon, label);
    if (kma) return kma;
    // KMA configured but failed (grid edge, outage, bad key) → fall through.
  }
  return fetchOpenMeteo(lat, lon, label);
}
