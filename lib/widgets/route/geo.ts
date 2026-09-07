/**
 * ============================================================================
 *  길찾기 위젯 — 순수 지오 계산 (서버·클라이언트 공용, 부수효과 없음)
 * ============================================================================
 *
 *  여기 있는 함수들은 전부 "조용히 틀릴 수 있는" 수학이다. 틀리면 크래시가 아니라
 *  **엉뚱한 방향 안내**나 **도로를 벗어난 경로선**으로 나타나므로 geo.test.ts가
 *  경계 케이스를 고정한다.
 *
 *  좌표 표기는 GeoJSON 관례를 따라 **[경도, 위도]** 순서다(TMAP 응답과 동일).
 *
 *  ⚠ TILE = 512인 이유(실측 확정): TMAP StaticMap은 표준 Web Mercator의 **2배**
 *  축척을 쓴다(= 512px 타일, 티맵 zoom z ≡ 표준 zoom z+1). 여러 Δ에 대한 픽셀
 *  상관 회귀로 배율 2.00000(오차 0.00%)을 실측했다 —
 *  `_workspace/verify-tmap-scale.mjs`. 이 값을 256으로 되돌리면 경로선이 지도와
 *  정확히 2배 어긋난다.
 */

/** [경도, 위도] 한 쌍. */
export type LonLat = [number, number];

/** 지도 이미지 배경을 요청하기 위한 중심·줌. */
export interface MapView {
  center: LonLat;
  zoom: number;
}

/** 경로를 감싸는 최소 사각형. */
export interface BBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

const EARTH_RADIUS_M = 6_371_000;
const TILE = 512;
/** TMAP StaticMap이 지원하는 줌 범위(공식 문서). */
export const MIN_ZOOM = 6;
export const MAX_ZOOM = 19;

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/* ------------------------------- 거리 ------------------------------------ */

/** 두 좌표 사이의 대권 거리(m). */
export function haversine(a: LonLat, b: LonLat): number {
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 각 점까지의 누적 거리(m). 항상 path와 같은 길이이며 [0]은 0이다. */
export function cumulativeDistances(path: readonly LonLat[]): number[] {
  const out: number[] = [0];
  for (let i = 1; i < path.length; i++) {
    out.push(out[i - 1] + haversine(path[i - 1], path[i]));
  }
  return out;
}

/** 경로 전체 길이(m). 빈 경로·1점 경로는 0. */
export function pathLength(path: readonly LonLat[]): number {
  const cum = cumulativeDistances(path);
  return cum.length === 0 ? 0 : cum[cum.length - 1];
}

/**
 * 경로를 **거리 기준 등간격** n점으로 다시 샘플링한다(양 끝 포함).
 *
 * 고도 API가 1요청당 좌표 100개까지만 받으므로 폴리라인(수백 점)을 여기로 줄인다.
 * 등간격이어야 고도 그래프의 X축(거리)이 왜곡되지 않는다.
 */
export function resamplePath(path: readonly LonLat[], n: number): LonLat[] {
  if (path.length === 0 || n <= 0) return [];
  if (path.length === 1 || n === 1) return [path[0]];

  const cum = cumulativeDistances(path);
  const total = cum[cum.length - 1];
  if (total === 0) return [path[0]];

  const out: LonLat[] = [];
  let seg = 0;
  for (let i = 0; i < n; i++) {
    const target = (total * i) / (n - 1);
    while (seg < cum.length - 2 && cum[seg + 1] < target) seg++;
    const span = cum[seg + 1] - cum[seg];
    const t = span === 0 ? 0 : (target - cum[seg]) / span;
    out.push([
      path[seg][0] + (path[seg + 1][0] - path[seg][0]) * t,
      path[seg][1] + (path[seg + 1][1] - path[seg][1]) * t,
    ]);
  }
  return out;
}

/**
 * `resamplePath(path, n)`이 만든 각 점의 **원본 경로상** 누적 거리(m).
 *
 * ⚠ 리샘플된 폴리라인을 다시 재면 안 된다 — 샘플 점들을 직선으로 이으면 원본의
 * 굽이를 가로질러 총 길이가 짧게 나온다(실측: 2,967m → 2,863m, 3.5% 손실).
 * 고도 그래프의 X축은 반드시 이 값을 써야 출발 0에서 시작해 총거리에서 끝난다.
 *
 * 반환 길이는 항상 resamplePath와 같다(퇴화 입력 포함).
 */
export function resampleDistances(path: readonly LonLat[], n: number): number[] {
  if (path.length === 0 || n <= 0) return [];
  if (path.length === 1 || n === 1) return [0];
  const total = pathLength(path);
  if (total === 0) return [0];
  return Array.from({ length: n }, (_, i) => (total * i) / (n - 1));
}

/* ---------------------- 현재 위치 → 경로상 위치 --------------------------- */

/** 현재 위치를 경로에 투영한 결과. */
export interface PathProjection {
  /** 출발지로부터의 **경로상** 누적 거리(m) — 고도 그래프의 X 위치이자 다음 안내까지의 기준. */
  distanceAlong: number;
  /** 경로에서 벗어난 수직 거리(m) — 이 값이 크면 "경로 이탈"로 판정한다. */
  offset: number;
  /** 경로 위의 가장 가까운 점. */
  snapped: LonLat;
}

/**
 * 점을 폴리라인에 투영한다(가장 가까운 지점).
 *
 * 국소 평면 근사(경도는 cos(위도)로 축소)를 쓴다 — 수 km 범위에서 오차가 cm 수준이라
 * 도보 경로엔 충분하고 대권 계산보다 훨씬 단순하다.
 */
export function projectOntoPath(
  path: readonly LonLat[],
  point: LonLat,
): PathProjection {
  if (path.length === 0) {
    return { distanceAlong: 0, offset: 0, snapped: point };
  }
  if (path.length === 1) {
    return { distanceAlong: 0, offset: haversine(path[0], point), snapped: path[0] };
  }

  const cum = cumulativeDistances(path);
  // 경도 1도의 미터 환산은 위도에 따라 달라진다 — 대상 점의 위도를 기준으로 고정.
  const mPerDegLat = 111_320;
  const mPerDegLon = 111_320 * Math.cos(toRad(point[1]));
  const px = point[0] * mPerDegLon;
  const py = point[1] * mPerDegLat;

  let best: PathProjection = {
    distanceAlong: 0,
    offset: Infinity,
    snapped: path[0],
  };

  for (let i = 0; i < path.length - 1; i++) {
    const ax = path[i][0] * mPerDegLon;
    const ay = path[i][1] * mPerDegLat;
    const bx = path[i + 1][0] * mPerDegLon;
    const by = path[i + 1][1] * mPerDegLat;
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    // 0으로 나누기 방지: 길이 0인 구간은 시작점으로 취급한다.
    const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
    const cx = ax + dx * t;
    const cy = ay + dy * t;
    const offset = Math.hypot(px - cx, py - cy);
    if (offset < best.offset) {
      const segLen = cum[i + 1] - cum[i];
      best = {
        distanceAlong: cum[i] + segLen * t,
        offset,
        snapped: [cx / mPerDegLon, cy / mPerDegLat],
      };
    }
  }
  return best;
}

/* ------------------------------ 투영/화면 -------------------------------- */

/** WGS84 → 월드 픽셀 좌표(주어진 줌 기준). */
export function project(lon: number, lat: number, zoom: number): { x: number; y: number } {
  const scale = TILE * 2 ** zoom;
  // 극지방에서 y가 발산하지 않도록 sin을 클램프한다.
  const s = Math.min(Math.max(Math.sin(toRad(lat)), -0.9999), 0.9999);
  return {
    x: ((lon + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale,
  };
}

/** 좌표 → 지도 이미지 안의 픽셀 위치(중심·줌·크기 기준). */
export function toPixel(
  point: LonLat,
  view: MapView,
  width: number,
  height: number,
): [number, number] {
  const c = project(view.center[0], view.center[1], view.zoom);
  const p = project(point[0], point[1], view.zoom);
  return [p.x - c.x + width / 2, p.y - c.y + height / 2];
}

/** 경로를 감싸는 bbox. 빈 경로는 null. */
export function boundsOf(path: readonly LonLat[]): BBox | null {
  if (path.length === 0) return null;
  let west = Infinity, east = -Infinity, south = Infinity, north = -Infinity;
  for (const [lon, lat] of path) {
    if (lon < west) west = lon;
    if (lon > east) east = lon;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }
  return { west, south, east, north };
}

/**
 * bbox 전체가 width×height 이미지 안에 들어오는 **가장 큰 정수 줌**과 중심을 고른다.
 *
 * 줌이 정수 단위라 여백은 최대 2배까지 남을 수 있다(지도 서비스 공통 제약).
 */
export function fitView(
  bounds: BBox,
  width: number,
  height: number,
  padding = 24,
): MapView {
  const center: LonLat = [
    (bounds.west + bounds.east) / 2,
    (bounds.south + bounds.north) / 2,
  ];
  const availW = Math.max(1, width - padding * 2);
  const availH = Math.max(1, height - padding * 2);

  for (let z = MAX_ZOOM; z > MIN_ZOOM; z--) {
    const a = project(bounds.west, bounds.north, z);
    const b = project(bounds.east, bounds.south, z);
    if (b.x - a.x <= availW && b.y - a.y <= availH) return { center, zoom: z };
  }
  return { center, zoom: MIN_ZOOM };
}

/* -------------------------------- 표시 ----------------------------------- */

/** 거리를 사람이 읽는 형태로. 1km 미만은 10m 단위로 반올림한다. */
export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return "";
  if (meters < 1000) return `${Math.round(meters / 10) * 10}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

/** 소요 시간(초)을 '21분' / '1시간 5분'으로. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "";
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}분`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}
