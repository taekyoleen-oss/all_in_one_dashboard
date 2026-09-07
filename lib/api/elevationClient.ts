/**
 * ============================================================================
 *  Elevation client — 경로 고도 프로파일 (Open-Meteo, 키 불필요)
 * ============================================================================
 *
 *  SERVER-ONLY. 좌표 목록의 해발 고도를 한 번에 조회한다.
 *
 *    • 출처: Open-Meteo Elevation API — Copernicus DEM 2021 GLO-90(**90m 해상도**),
 *      비상업 용도 키 불필요. 이 저장소가 날씨에 이미 쓰는 제공자와 같다.
 *    • **1요청당 좌표 100개 상한**(실측 확인: 101개는 400 + "must not exceed 100
 *      coordinates"). 호출부는 그 전에 경로를 리샘플해서 넘겨야 한다.
 *
 *  ⚠ 90m 해상도의 의미: 도심의 짧은 경로는 거의 평평하게 나오고 계단·육교·지하보도는
 *  잡히지 않는다. 언덕·산길에서 의미가 있다. UI는 이를 '근사치'로 밝혀야 한다.
 */

const FETCH_TIMEOUT_MS = 8_000;

/** Open-Meteo가 한 요청에서 받는 좌표 최대 개수(실측 확인). */
export const MAX_ELEVATION_POINTS = 100;

/** 고도 데이터 출처 표기 — UI가 '근사치'임을 밝힐 때 쓴다. */
export const ELEVATION_SOURCE = "Copernicus DEM GLO-90 (90m 해상도 근사)";

/**
 * 좌표들의 해발 고도(m)를 순서대로 반환한다.
 *
 * 실패(네트워크·상한 초과·형식 불일치)하면 **null**을 반환한다 — 호출부는 고도 없이
 * 경로만 내려보내면 된다(고도는 부가 정보라 지도까지 같이 죽이지 않는다).
 */
export async function fetchElevations(
  points: ReadonlyArray<{ lat: number; lon: number }>,
): Promise<number[] | null> {
  if (points.length === 0) return [];
  if (points.length > MAX_ELEVATION_POINTS) return null;

  const lats = points.map((p) => p.lat.toFixed(5)).join(",");
  const lons = points.map((p) => p.lon.toFixed(5)).join(",");
  const url = `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lons}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { elevation?: unknown };
    const list = json.elevation;
    if (!Array.isArray(list) || list.length !== points.length) return null;
    // 제공자가 일부 좌표에 null을 줄 수 있다 — 하나라도 숫자가 아니면 프로파일을 포기한다
    // (그래프에 구멍이 뚫린 채 그리느니 고도 없이 지도만 보여주는 편이 정직하다).
    if (!list.every((v) => typeof v === "number" && Number.isFinite(v))) return null;
    return list as number[];
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
