/**
 * ============================================================================
 *  Geocode client — place/address search → lat/lon (날씨 위치 검색)
 * ============================================================================
 *
 *  SERVER-ONLY. Turns a free-text query (주소 동 단위, 골프장·랜드마크 이름 등) into
 *  candidate locations with coordinates, so the weather widget can be pinned to a
 *  precise spot — not just a curated city.
 *
 *    • PRIMARY  : Kakao Local (keyword + address) when a Kakao key is set —
 *      `KAKAO_LOCAL_API_KEY` (preferred) or `KAKAO_REST_API_KEY` (legacy). Both
 *      are the same Kakao Developers REST API 키. Best for Korean POIs incl. 골프장
 *      and 동-level addresses. Server-only key.
 *    • FALLBACK : Nominatim (OpenStreetMap) — keyless, works today. Decent KR
 *      coverage incl. many golf courses; requires a descriptive User-Agent and
 *      light usage (this is a single-user personal app).
 *
 *  Both produce the SAME normalized GeoResult[] so the UI renders one shape.
 * ============================================================================
 */

const FETCH_TIMEOUT_MS = 8_000;

export interface GeoResult {
  /** Short display name (place or address). */
  label: string;
  /** Fuller address/description for disambiguation. */
  detail: string;
  lat: number;
  lon: number;
}

/**
 * The configured Kakao REST API 키, reading `KAKAO_LOCAL_API_KEY` first and
 * falling back to the legacy `KAKAO_REST_API_KEY`. Returns "" when neither set.
 */
function kakaoKey(): string {
  return (
    process.env.KAKAO_LOCAL_API_KEY?.trim() ||
    process.env.KAKAO_REST_API_KEY?.trim() ||
    ""
  );
}

/** True iff a Kakao REST key is configured (enables the richer KR provider). */
export function hasKakaoKey(): boolean {
  return Boolean(kakaoKey());
}

async function fetchJson(
  url: string,
  headers?: Record<string, string>,
): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json", ...headers },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------- Kakao Local ------------------------------ */

interface KakaoDoc {
  place_name?: string;
  address_name?: string;
  road_address_name?: string;
  x?: string; // lon
  y?: string; // lat
}

function kakaoDocToResult(d: KakaoDoc): GeoResult | null {
  const lat = Number(d.y);
  const lon = Number(d.x);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const label = (d.place_name || d.address_name || "").trim();
  if (!label) return null;
  const detail = (d.road_address_name || d.address_name || "").trim();
  return { label, detail, lat, lon };
}

async function searchKakao(query: string, limit: number): Promise<GeoResult[]> {
  const key = kakaoKey();
  if (!key) return [];
  const headers = { Authorization: `KakaoAK ${key}` };
  const enc = encodeURIComponent(query);
  // Keyword search covers POIs (골프장·건물·랜드마크); address search nails 동 주소.
  const [kw, addr] = await Promise.all([
    fetchJson(
      `https://dapi.kakao.com/v2/local/search/keyword.json?query=${enc}&size=${limit}`,
      headers,
    ),
    fetchJson(
      `https://dapi.kakao.com/v2/local/search/address.json?query=${enc}&size=${limit}`,
      headers,
    ),
  ]);
  const out: GeoResult[] = [];
  for (const src of [kw, addr]) {
    const docs = (src as { documents?: KakaoDoc[] } | null)?.documents ?? [];
    for (const d of docs) {
      const r = kakaoDocToResult(d);
      if (r) out.push(r);
    }
  }
  return out;
}

/* -------------------------------- Nominatim ------------------------------- */

interface NominatimItem {
  display_name?: string;
  name?: string;
  lat?: string;
  lon?: string;
}

async function searchNominatim(
  query: string,
  limit: number,
): Promise<GeoResult[]> {
  const enc = encodeURIComponent(query);
  const url = `https://nominatim.openstreetmap.org/search?q=${enc}&format=jsonv2&accept-language=ko&addressdetails=0&limit=${limit}`;
  const json = await fetchJson(url, {
    // Nominatim policy requires a descriptive UA identifying the app.
    "User-Agent": "PaneBoard/1.0 (personal dashboard; weather location search)",
  });
  const items = (json as NominatimItem[] | null) ?? [];
  const out: GeoResult[] = [];
  for (const it of items) {
    const lat = Number(it.lat);
    const lon = Number(it.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const full = (it.display_name ?? "").trim();
    const label = (it.name || full.split(",")[0] || "").trim();
    if (!label) continue;
    out.push({ label, detail: full, lat, lon });
  }
  return out;
}

/* ------------------------- reverse geocode (coord→동) ---------------------- */

/** One reverse-geocode hit: a friendly place name + a fuller address. */
export interface ReverseResult {
  /** Short name to show (행정동/법정동, e.g. "역삼동"). */
  label: string;
  /** Fuller address for context (e.g. "서울특별시 강남구 역삼동"). */
  detail: string;
}

interface KakaoRegionDoc {
  region_type?: string; // "H" 행정동, "B" 법정동
  address_name?: string;
  region_1depth_name?: string;
  region_2depth_name?: string;
  region_3depth_name?: string; // 동
}

/** Kakao coord2regioncode → 동 name (prefers 행정동 "H"). */
async function reverseKakao(lat: number, lon: number): Promise<ReverseResult | null> {
  const key = kakaoKey();
  if (!key) return null;
  const json = await fetchJson(
    `https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?x=${lon}&y=${lat}`,
    { Authorization: `KakaoAK ${key}` },
  );
  const docs = (json as { documents?: KakaoRegionDoc[] } | null)?.documents ?? [];
  if (docs.length === 0) return null;
  const pick = docs.find((d) => d.region_type === "H") ?? docs[0];
  const dong = (pick.region_3depth_name || "").trim();
  const label =
    dong || (pick.region_2depth_name || "").trim() || (pick.address_name || "").trim();
  if (!label) return null;
  const detail = (pick.address_name || "").trim() || label;
  return { label, detail };
}

interface NominatimReverse {
  display_name?: string;
  address?: Record<string, string>;
}

/** Nominatim reverse → best 동-level name from the address parts (keyless). */
async function reverseNominatim(
  lat: number,
  lon: number,
): Promise<ReverseResult | null> {
  const json = await fetchJson(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=jsonv2&accept-language=ko&addressdetails=1&zoom=18`,
    { "User-Agent": "PaneBoard/1.0 (personal dashboard; reverse geocode)" },
  );
  const data = json as NominatimReverse | null;
  if (!data) return null;
  const a = data.address ?? {};
  // Korean 동 typically lands in one of these OSM keys; try most-specific first.
  const label =
    (
      a.quarter ||
      a.neighbourhood ||
      a.suburb ||
      a.city_district ||
      a.town ||
      a.village ||
      a.borough ||
      ""
    ).trim();
  const detail = (data.display_name || "").trim();
  if (!label) {
    // Fall back to the leading segment of the full display name.
    const lead = detail.split(",")[0]?.trim();
    if (!lead) return null;
    return { label: lead, detail };
  }
  return { label, detail };
}

/**
 * Reverse geocode coordinates to a friendly 동-level place name. Kakao when keyed
 * (accurate 행정동), else keyless Nominatim. Returns null on a failed lookup so the
 * caller can keep a generic label.
 */
export async function reverseGeocode(
  lat: number,
  lon: number,
): Promise<ReverseResult | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return hasKakaoKey()
    ? await reverseKakao(lat, lon)
    : await reverseNominatim(lat, lon);
}

/* --------------------------------- public --------------------------------- */

/** De-dupe by rounded coordinate (≈100m) keeping the first (most relevant). */
function dedupe(results: GeoResult[], limit: number): GeoResult[] {
  const seen = new Set<string>();
  const out: GeoResult[] = [];
  for (const r of results) {
    const key = `${r.lat.toFixed(3)},${r.lon.toFixed(3)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Search places/addresses for a query. Kakao when keyed (richer KR results incl.
 * 골프장·동 주소), else keyless Nominatim. Returns [] on empty/failed lookups.
 */
export async function searchPlaces(
  query: string,
  limit = 8,
): Promise<GeoResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const results = hasKakaoKey()
    ? await searchKakao(q, limit)
    : await searchNominatim(q, limit);
  return dedupe(results, limit);
}
