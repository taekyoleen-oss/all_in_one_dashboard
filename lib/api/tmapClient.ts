/**
 * ============================================================================
 *  TMAP client — 보행자 경로안내 + StaticMap 배경 이미지
 * ============================================================================
 *
 *  SERVER-ONLY. `TMAP_APP_KEY`(앱 단위 발급)는 절대 클라이언트로 나가지 않는다 —
 *  지도 이미지조차 `/api/map/static` 프록시를 거친다(가드레일: 외부 API 키 서버 전용).
 *
 *  ── 계정 설정(막히면 여기부터) ─────────────────────────────────────────────
 *  openapi.sk.com에서 앱을 만들고 **상품 사용 신청**까지 해야 한다. 앱만 만들고
 *  키를 복사하면 모든 호출이 `403 gw/INVALID_API_KEY`로 떨어진다(신청된 상품이
 *  하나도 없으면 전 상품이 똑같이 403 — 실제로 겪은 함정).
 *  필요한 상품: **보행자 경로 안내**, **StaticMap**.
 *
 *  ── 무료 한도(Free 요금제) ────────────────────────────────────────────────
 *  경로안내 1,000건/일(자동차·보행자 등 합산) · StaticMap 1,000건/일.
 *  **초과 시 과금이 아니라 자동 차단**이라 요금 사고는 나지 않는다.
 *
 *  ── 서비스 제공 지역 ──────────────────────────────────────────────────────
 *  보행자 경로는 전국이 아니다: 서울·수도권 시지역·6대광역시·제주도 + 강원/경남/
 *  경북/전남/전북/충남/충북 주요 시. 밖이면 경로가 비어 오므로 호출부가 안내한다.
 */

import type { LonLat } from "@/lib/widgets/route/geo";

const ROUTE_URL = "https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1";
const STATIC_URL = "https://apis.openapi.sk.com/tmap/staticMap";
const FETCH_TIMEOUT_MS = 10_000;

/** StaticMap이 반환할 수 있는 이미지 한 변의 최대 크기(공식 문서). */
export const STATIC_MAP_MAX_SIZE = 512;

/** 경로 탐색 옵션 — 0 추천(기본) / 30 최단거리+계단 제외. */
export type WalkSearchOption = "0" | "30";

export interface TmapPoint {
  lon: number;
  lat: number;
  name: string;
}

/** 정규화된 보행자 경로(라우트 핸들러가 고도와 합쳐 응답으로 만든다). */
export interface TmapWalkRoute {
  path: LonLat[];
  steps: {
    index: number;
    lon: number;
    lat: number;
    turnType: number;
    description: string;
    name: string;
    pointType: string;
    distanceFromStart: number;
  }[];
  totalDistance: number;
  totalTime: number;
}

/** 호출 실패 사유 — 라우트가 상태코드와 사용자 문구로 옮긴다. */
export type TmapFailure = "no_key" | "auth" | "unsupported_area" | "upstream";

export class TmapError extends Error {
  constructor(
    readonly reason: TmapFailure,
    message: string,
  ) {
    super(message);
    this.name = "TmapError";
  }
}

function appKey(): string {
  return process.env.TMAP_APP_KEY?.trim() ?? "";
}

/** 앱 키가 설정돼 있는가(없으면 라우트가 503으로 안내). */
export function hasTmapKey(): boolean {
  return Boolean(appKey());
}

/* ---------------------------- 보행자 경로안내 ----------------------------- */

interface TmapFeature {
  geometry?: { type?: string; coordinates?: unknown };
  properties?: Record<string, unknown>;
}

const num = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) ? v : 0;
const str = (v: unknown): string => (typeof v === "string" ? v : "");

/**
 * 출발→도착 도보 경로를 조회해 정규화한다.
 *
 * TMAP 응답은 GeoJSON FeatureCollection이고 **Point(안내지점)와 LineString(구간)이
 * index 순으로 교대**한다(실응답 확인). 그래서 features를 index 순으로 한 번 훑으며
 * LineString의 `distance`를 누적하면, 각 안내지점의 출발지로부터 거리를 **추정이 아니라
 * 정확히** 얻는다(실측: 구간 distance 합 = totalDistance, 오차 0).
 */
export async function fetchWalkRoute(
  start: TmapPoint,
  end: TmapPoint,
  searchOption: WalkSearchOption = "0",
): Promise<TmapWalkRoute> {
  const key = appKey();
  if (!key) throw new TmapError("no_key", "TMAP_APP_KEY가 설정되지 않았습니다.");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(ROUTE_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        appKey: key,
        // 공식 문서상 Accept는 필수다(생략 시 응답 형식이 보장되지 않는다).
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        startX: String(start.lon),
        startY: String(start.lat),
        endX: String(end.lon),
        endY: String(end.lat),
        // 명칭은 UTF-8 URL 인코딩 필수(공식 문서).
        startName: encodeURIComponent(start.name || "출발"),
        endName: encodeURIComponent(end.name || "도착"),
        reqCoordType: "WGS84GEO",
        resCoordType: "WGS84GEO",
        searchOption,
      }),
    });
  } catch {
    throw new TmapError("upstream", "경로 서버에 연결하지 못했습니다.");
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 401 || res.status === 403) {
    // 키가 틀렸거나, 그 앱에 '보행자 경로 안내' 상품이 신청되지 않은 경우.
    throw new TmapError(
      "auth",
      "TMAP 인증에 실패했습니다(앱 키·상품 사용 신청 확인).",
    );
  }
  if (!res.ok) {
    // 서비스 제공 지역 밖이면 TMAP은 빈 결과가 아니라 **400 + 전용 코드**를 준다.
    // (실측: 울릉도 → code 3102 "해당 서비스가 지원되지 않는 구간입니다.
    //  ([NoServiceArea]...)". 공식 코드표엔 3002로 적혀 있어 둘 다 받고, 더 안정적인
    //  메시지 문구로도 판정한다.) 이걸 일반 오류로 뭉개면 사용자가 원인을 알 수 없다.
    const detail = (await res.text().catch(() => "")) || "";
    const outOfArea =
      /"code"\s*:\s*"?(3102|3002)"?/.test(detail) ||
      detail.includes("지원되지 않는 구간") ||
      detail.includes("NoServiceArea");
    if (outOfArea) {
      throw new TmapError(
        "unsupported_area",
        "이 지역은 도보 경로가 제공되지 않습니다(티맵 보행자 경로 서비스 지역 밖).",
      );
    }
    throw new TmapError("upstream", `경로를 가져오지 못했습니다 (${res.status}).`);
  }

  const json = (await res.json()) as { features?: TmapFeature[] };
  const features = Array.isArray(json.features) ? json.features : [];
  if (features.length === 0) {
    throw new TmapError(
      "unsupported_area",
      "이 구간의 도보 경로가 제공되지 않습니다.",
    );
  }

  const ordered = [...features].sort(
    (a, b) => num(a.properties?.index) - num(b.properties?.index),
  );

  const path: LonLat[] = [];
  const steps: TmapWalkRoute["steps"] = [];
  let totalDistance = 0;
  let totalTime = 0;
  // 지금까지 훑은 구간 거리의 합 = 다음에 만나는 안내지점의 '출발지로부터 거리'.
  let travelled = 0;

  for (const f of ordered) {
    const p = f.properties ?? {};
    // 총거리·총시간은 출발지(pointType=SP) feature에만 실려 온다.
    if (p.totalDistance != null) totalDistance = num(p.totalDistance);
    if (p.totalTime != null) totalTime = num(p.totalTime);

    if (f.geometry?.type === "Point") {
      const c = f.geometry.coordinates;
      if (!Array.isArray(c) || c.length < 2) continue;
      steps.push({
        index: steps.length,
        lon: num(c[0]),
        lat: num(c[1]),
        turnType: num(p.turnType),
        description: str(p.description),
        name: str(p.name),
        pointType: str(p.pointType),
        distanceFromStart: travelled,
      });
    } else if (f.geometry?.type === "LineString") {
      const coords = f.geometry.coordinates;
      if (Array.isArray(coords)) {
        for (const c of coords) {
          if (!Array.isArray(c) || c.length < 2) continue;
          const pt: LonLat = [num(c[0]), num(c[1])];
          const last = path[path.length - 1];
          // 구간 경계에서 같은 점이 두 번 오므로 중복을 접는다.
          if (!last || last[0] !== pt[0] || last[1] !== pt[1]) path.push(pt);
        }
      }
      travelled += num(p.distance);
    }
  }

  if (path.length < 2) {
    throw new TmapError(
      "unsupported_area",
      "이 구간의 도보 경로가 제공되지 않습니다.",
    );
  }
  // 총거리가 안 실려 온 경우에만 누적값으로 대체(정상 응답에선 그대로 일치한다).
  if (totalDistance === 0) totalDistance = travelled;

  return { path, steps, totalDistance, totalTime };
}

/* ------------------------------ StaticMap -------------------------------- */

/**
 * 지도 배경 이미지(PNG) 원본 바이트를 가져온다. 앱 키는 여기서만 붙는다.
 *
 * ⚠ 이 이미지는 **표준 Web Mercator의 2배 축척**(512px 타일)이다 — 오버레이 좌표는
 *   반드시 `lib/widgets/route/geo.ts`의 project()를 써야 한다. 상세는 그 파일 주석.
 * ⚠ `markers` 파라미터는 실제로 핀을 그리지 않는다(픽셀 diff로 확인). 출발·도착·
 *   현재위치 표시는 전부 클라이언트 SVG로 그린다.
 */
export async function fetchStaticMap(
  center: { lon: number; lat: number },
  zoom: number,
  width: number,
  height: number,
): Promise<{ body: ArrayBuffer; contentType: string }> {
  const key = appKey();
  if (!key) throw new TmapError("no_key", "TMAP_APP_KEY가 설정되지 않았습니다.");

  const params = new URLSearchParams({
    version: "1",
    appKey: key,
    coordType: "WGS84GEO",
    longitude: String(center.lon),
    latitude: String(center.lat),
    zoom: String(zoom),
    width: String(width),
    height: String(height),
    format: "PNG",
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${STATIC_URL}?${params}`, {
      signal: controller.signal,
      cache: "no-store",
    });
  } catch {
    throw new TmapError("upstream", "지도 이미지를 가져오지 못했습니다.");
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 401 || res.status === 403) {
    throw new TmapError(
      "auth",
      "TMAP 인증에 실패했습니다(앱 키·상품 사용 신청 확인).",
    );
  }
  if (!res.ok) {
    throw new TmapError(
      "upstream",
      `지도 이미지를 가져오지 못했습니다 (${res.status}).`,
    );
  }

  return {
    body: await res.arrayBuffer(),
    contentType: res.headers.get("content-type") ?? "image/png",
  };
}
