/**
 * ============================================================================
 *  GET /api/route/walk?sx=&sy=&ex=&ey= — 도보 경로 + 고도 프로파일
 * ============================================================================
 *
 *  TMAP 보행자 경로안내(서버 키)와 Open-Meteo 고도(키리스)를 합쳐 위젯이 한 번의
 *  fetch로 필요한 모든 것을 받게 한다. 응답은 WalkRouteSchema(output/api-shapes.ts)
 *  로 검증한 뒤 나가며, 두 upstream의 원형은 클라이언트에 노출되지 않는다.
 *
 *  ── 왜 고도를 여기서 같이 받나 ─────────────────────────────────────────────
 *  고도는 경로 폴리라인을 거리 등간격 100점으로 줄인 좌표에만 의존한다. 클라이언트가
 *  따로 부르면 왕복이 한 번 더 늘고 리샘플 로직이 양쪽에 생긴다. 서버에서 합치면
 *  두 upstream이 같은 캐시 항목으로 묶인다.
 *
 *  ── 고도 실패는 경로를 죽이지 않는다 ───────────────────────────────────────
 *  고도 조회가 실패하면 `elevation: []`으로 내려가고 지도는 정상 동작한다. 부가
 *  정보 때문에 주 기능을 잃지 않는다.
 *
 *  캐싱: 도보 경로는 하루 단위로 바뀌지 않으므로 s-maxage=86400. 좌표가 캐시 키라
 *  같은 출발·도착이면 CDN이 받아내고 TMAP 무료 한도(경로 1,000건/일)를 거의 쓰지
 *  않는다. 401은 no-store라 캐시되지 않는다.
 *
 *  Route Handler (Next.js 16). 요청 URL을 읽으므로 동적이며, 캐싱은 응답의
 *  Cache-Control로 한다(weather 라우트와 같은 패턴).
 */

import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/api/requireUser";
import {
  fetchWalkRoute,
  TmapError,
  hasTmapKey,
  type WalkSearchOption,
} from "@/lib/api/tmapClient";
import {
  fetchElevations,
  MAX_ELEVATION_POINTS,
  ELEVATION_SOURCE,
} from "@/lib/api/elevationClient";
import {
  boundsOf,
  resampleDistances,
  resamplePath,
} from "@/lib/widgets/route/geo";
import { WalkRouteSchema, type WalkRoute } from "@/output/api-shapes";

const CACHE_HEADERS = {
  "cache-control": "public, s-maxage=86400, stale-while-revalidate=172800",
} as const;
const NO_STORE = { "cache-control": "no-store" } as const;

/** 실패 사유 → HTTP 상태코드. 사용자 문구는 클라이언트가 그대로 보여준다. */
const STATUS_BY_REASON: Record<string, number> = {
  no_key: 503,
  auth: 503,
  unsupported_area: 422,
  upstream: 502,
};

/** 좌표 한 쌍을 읽고 범위를 검증한다. 잘못되면 null. */
function coord(
  params: URLSearchParams,
  xKey: string,
  yKey: string,
): { lon: number; lat: number } | null {
  const rawLon = params.get(xKey);
  const rawLat = params.get(yKey);
  // 누락을 먼저 거른다 — Number(null)은 NaN이 아니라 **0**이라, 이 검사를 빼면
  // 파라미터 없는 요청이 (0,0) 좌표로 업스트림까지 가서 502가 된다(실제로 겪음).
  if (rawLon === null || rawLat === null || rawLon === "" || rawLat === "") return null;
  const lon = Number(rawLon);
  const lat = Number(rawLat);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lon, lat };
}

export async function GET(request: NextRequest) {
  // 인증 게이트 — 익명 호출로 TMAP 무료 한도를 소모당하지 않도록.
  const gate = await requireUser();
  if (gate) return gate;

  const { searchParams } = new URL(request.url);
  const start = coord(searchParams, "sx", "sy");
  const end = coord(searchParams, "ex", "ey");
  if (!start || !end) {
    return Response.json(
      {
        error: "bad_request",
        message: "출발·도착 좌표(sx, sy, ex, ey)가 필요합니다.",
      },
      { status: 400, headers: NO_STORE },
    );
  }

  if (!hasTmapKey()) {
    return Response.json(
      {
        error: "no_key",
        message:
          "길찾기를 사용하려면 TMAP 앱 키가 필요합니다(서버 설정 TMAP_APP_KEY).",
      },
      { status: 503, headers: NO_STORE },
    );
  }

  // 계단 회피(searchOption 30)는 위젯 설정에서 온다. 그 외 값은 추천(0)으로 고정.
  const searchOption: WalkSearchOption =
    searchParams.get("avoidStairs") === "1" ? "30" : "0";

  let route;
  try {
    route = await fetchWalkRoute(
      { ...start, name: searchParams.get("sname") ?? "출발" },
      { ...end, name: searchParams.get("ename") ?? "도착" },
      searchOption,
    );
  } catch (e) {
    const err = e instanceof TmapError ? e : null;
    const reason = err?.reason ?? "upstream";
    return Response.json(
      {
        error: reason,
        message: err?.message ?? "경로를 가져오지 못했습니다.",
      },
      { status: STATUS_BY_REASON[reason] ?? 502, headers: NO_STORE },
    );
  }

  // 고도: 폴리라인을 거리 등간격 100점으로 줄여 1회만 조회한다(제공자 상한).
  const samples = resamplePath(route.path, MAX_ELEVATION_POINTS);
  // 거리축은 **원본 경로** 기준으로 잡는다 — 리샘플된 선을 다시 재면 굽이를 가로질러
  // 총거리가 짧아진다(실측 2,967m → 2,863m). geo.ts의 resampleDistances 주석 참고.
  const sampleDistances = resampleDistances(route.path, samples.length);
  const elevations = await fetchElevations(
    samples.map(([lon, lat]) => ({ lon, lat })),
  );

  const elevation =
    elevations === null
      ? []
      : elevations.map((value, i) => ({
          distance: sampleDistances[i],
          elevation: value,
        }));

  // boundsOf는 빈 경로에서만 null인데, 여기까지 온 경로는 2점 이상이 보장된다.
  const bounds = boundsOf(route.path) ?? {
    west: start.lon,
    south: start.lat,
    east: end.lon,
    north: end.lat,
  };

  const body: WalkRoute = {
    path: route.path,
    steps: route.steps,
    elevation,
    totalDistance: route.totalDistance,
    totalTime: route.totalTime,
    bounds,
    elevationSource: elevation.length > 0 ? ELEVATION_SOURCE : null,
  };

  const parsed = WalkRouteSchema.safeParse(body);
  if (!parsed.success) {
    // 우리 정규화가 계약을 어긴 경우 — 깨진 shape를 위젯에 흘리지 않는다.
    return Response.json(
      { error: "upstream", message: "경로 응답을 해석하지 못했습니다." },
      { status: 502, headers: NO_STORE },
    );
  }

  return Response.json(parsed.data, { headers: CACHE_HEADERS });
}
