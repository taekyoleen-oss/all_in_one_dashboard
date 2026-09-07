/**
 * ============================================================================
 *  GET /api/map/static?lat=&lon=&zoom=&w=&h= — 지도 배경 이미지 프록시
 * ============================================================================
 *
 *  TMAP StaticMap PNG를 그대로 중계한다. 존재 이유는 하나 — **앱 키를 서버 안에
 *  가두기 위해서**다(가드레일: 외부 API 키 클라이언트 미노출). 위젯의 <img>는
 *  이 경로를 가리키고, 경로선·마커는 그 위에 클라이언트 SVG로 겹친다.
 *
 *  ⚠ 이미지는 표준 Web Mercator의 **2배 축척**(512px 타일)이다. 오버레이 좌표는
 *    반드시 lib/widgets/route/geo.ts의 project()를 쓴다.
 *
 *  캐싱: 같은 (중심·줌·크기)면 같은 그림이므로 immutable + 1주일. 지도 타일은
 *  자주 바뀌지 않고, 이 캐시가 StaticMap 무료 한도(1,000건/일)를 지켜준다.
 *
 *  Route Handler (Next.js 16). 요청 URL을 읽으므로 동적.
 */

import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/api/requireUser";
import {
  fetchStaticMap,
  hasTmapKey,
  TmapError,
  STATIC_MAP_MAX_SIZE,
} from "@/lib/api/tmapClient";
import { MIN_ZOOM, MAX_ZOOM } from "@/lib/widgets/route/geo";

const CACHE_HEADERS = {
  "cache-control": "public, s-maxage=604800, max-age=86400, immutable",
} as const;
const NO_STORE = { "cache-control": "no-store" } as const;

const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, v));

export async function GET(request: NextRequest) {
  // 인증 게이트 — 익명 호출로 StaticMap 무료 한도를 소모당하지 않도록.
  const gate = await requireUser();
  if (gate) return gate;

  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));
  const zoomRaw = Number(searchParams.get("zoom"));

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180 ||
    !Number.isFinite(zoomRaw)
  ) {
    return Response.json(
      { error: "bad_request", message: "lat, lon, zoom이 필요합니다." },
      { status: 400, headers: NO_STORE },
    );
  }

  // 업스트림이 거부하는 값을 보내기 전에 여기서 정리한다(문서상 zoom 6~19, 한 변 ≤512).
  const zoom = clamp(Math.round(zoomRaw), MIN_ZOOM, MAX_ZOOM);
  const width = clamp(
    Math.round(Number(searchParams.get("w")) || STATIC_MAP_MAX_SIZE),
    1,
    STATIC_MAP_MAX_SIZE,
  );
  const height = clamp(
    Math.round(Number(searchParams.get("h")) || STATIC_MAP_MAX_SIZE),
    1,
    STATIC_MAP_MAX_SIZE,
  );

  if (!hasTmapKey()) {
    return Response.json(
      { error: "no_key", message: "지도를 사용하려면 TMAP 앱 키가 필요합니다." },
      { status: 503, headers: NO_STORE },
    );
  }

  try {
    const { body, contentType } = await fetchStaticMap(
      { lat, lon },
      zoom,
      width,
      height,
    );
    return new Response(body, {
      headers: { "content-type": contentType, ...CACHE_HEADERS },
    });
  } catch (e) {
    const err = e instanceof TmapError ? e : null;
    return Response.json(
      {
        error: err?.reason ?? "upstream",
        message: err?.message ?? "지도 이미지를 가져오지 못했습니다.",
      },
      { status: err?.reason === "auth" ? 503 : 502, headers: NO_STORE },
    );
  }
}
