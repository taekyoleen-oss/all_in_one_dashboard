"use client";

/**
 * RouteMap — 티맵 지도 위에 경로선·마커를 SVG로 겹치고, 눌러서 지점을 고른다.
 *
 *  지도는 `/api/map/static` 프록시가 주는 PNG(앱 키는 서버 안에 머문다). StaticMap은
 *  경로선을 그려주지 않으므로 폴리라인·핀·현재위치는 전부 여기서 SVG로 그린다.
 *
 *  ── 해상도: 한 장이 아니라 타일 모자이크 ──────────────────────────────────
 *  StaticMap은 **한 장이 512×512를 넘지 못한다**(width=1024를 넣어도 512로 잘려 돌아온다.
 *  scale·dpi·retina 같은 배율 파라미터도 없다 — `_workspace/probe-static-resolution.mjs`
 *  실측). 예전에는 큰 화면에 512짜리 한 장을 늘려 붙여서 2배 흐릿했다.
 *
 *  투영을 우리가 정확히 알고 있으므로(P0에서 확정) 512 조각을 격자로 여러 장 받아
 *  이어 붙이면 실제 픽셀 1:1로 선명해진다. 조각 수는 `MAX_TILES`로 묶는다 —
 *  한 번 그릴 때마다 StaticMap을 그만큼 부르기 때문(무료 한도 1,000건/일, 다만
 *  같은 조각은 CDN이 일주일 캐시하므로 되돌아오면 공짜다).
 *
 *  ⚠ 좌표 변환은 반드시 `geo.ts`를 쓴다 — 티맵 이미지는 표준 Web Mercator의 **2배
 *    축척**(512px 타일)이라 표준 공식을 쓰면 선이 2배 어긋난다.
 */

import * as React from "react";
import {
  fitView,
  fromPixel,
  toPixel,
  unproject,
  project,
  type BBox,
  type LonLat,
  type MapView,
} from "@/lib/widgets/route/geo";

/** StaticMap 한 장의 픽셀 크기(업스트림 상한이자 우리 격자의 한 칸). */
const TILE_PX = 512;
/** 한 번에 요청할 조각 수 상한 — 화면이 아무리 커도 이 이상 부르지 않는다. */
const MAX_TILES = 6;
/** 경로가 가장자리에 붙지 않도록 남기는 여백(논리 px). */
const FIT_PADDING = 24;

interface Box {
  w: number;
  h: number;
}

/** 컨테이너를 덮는 512 격자 크기. 조각이 너무 많아지면 축소로 되돌아간다. */
function tileGrid({ w, h }: Box): { cols: number; rows: number; scale: number } {
  const cols = Math.max(1, Math.ceil(w / TILE_PX));
  const rows = Math.max(1, Math.ceil(h / TILE_PX));
  if (cols * rows <= MAX_TILES) return { cols, rows, scale: 1 };
  // 상한을 넘으면 예전처럼 한 장으로 줄여 받는다(선명도보다 요청 수를 지킨다).
  return { cols: 1, rows: 1, scale: Math.min(1, TILE_PX / Math.max(w, h)) };
}

function MapLayers({
  box,
  path,
  bounds,
  current,
  startPoint,
  endPoint,
  viaPoints,
  onPick,
}: {
  box: Box;
  path: LonLat[];
  bounds: BBox;
  current?: LonLat | null;
  startPoint?: LonLat | null;
  endPoint?: LonLat | null;
  viaPoints?: LonLat[];
  onPick?: (point: LonLat) => void;
}) {
  const { cols, rows, scale } = tileGrid(box);
  // 논리 좌표계 — 오버레이 SVG와 조각 배치가 공유한다.
  const W = Math.max(1, Math.round(box.w * scale));
  const H = Math.max(1, Math.round(box.h * scale));
  const view: MapView = fitView(bounds, W, H, FIT_PADDING);

  // 격자 전체(cols×rows 조각)를 컨테이너 중앙에 맞춘다. 넘치는 부분은 잘린다.
  const gridW = cols * (scale === 1 ? TILE_PX : W);
  const gridH = rows * (scale === 1 ? TILE_PX : H);
  const originX = W / 2 - gridW / 2;
  const originY = H / 2 - gridH / 2;
  const center = project(view.center[0], view.center[1], view.zoom);

  // 조각 한 칸의 논리 크기 — 격자 모드면 512, 축소 모드(1장)면 화면 전체.
  const tileW = scale === 1 ? TILE_PX : W;
  const tileH = scale === 1 ? TILE_PX : H;

  const tiles: { key: string; left: number; top: number; src: string }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const left = originX + c * tileW;
      const top = originY + r * tileH;
      // 이 조각의 중심이 논리 좌표계에서 어디인지 → 월드 픽셀 → 좌표
      const [lon, lat] = unproject(
        center.x + left + tileW / 2 - W / 2,
        center.y + top + tileH / 2 - H / 2,
        view.zoom,
      );
      tiles.push({
        key: `${c},${r}`,
        left,
        top,
        src: `/api/map/static?lat=${lat.toFixed(6)}&lon=${lon.toFixed(6)}&zoom=${view.zoom}&w=${tileW}&h=${tileH}`,
      });
    }
  }

  const points = path.map((p) => toPixel(p, view, W, H));
  const line = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  // 마커는 명시 지점이 있으면 그것을, 없으면 경로의 양 끝을 쓴다 — 아직 탐색하지
  // 않은 미리보기에서도 출발·도착이 보여야 한다.
  const startSrc = startPoint ?? path[0] ?? null;
  const endSrc = endPoint ?? path[path.length - 1] ?? null;
  const startPx = startSrc ? toPixel(startSrc, view, W, H) : null;
  const endPx = endSrc ? toPixel(endSrc, view, W, H) : null;
  const curPx = current ? toPixel(current, view, W, H) : null;
  const viaPx = (viaPoints ?? []).map((p) => toPixel(p, view, W, H));

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onPick) return;
    const rect = e.currentTarget.getBoundingClientRect();
    // 화면 픽셀 → 논리 좌표계 → 지도 좌표.
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const y = ((e.clientY - rect.top) / rect.height) * H;
    onPick(fromPixel(x, y, view, W, H));
  };

  return (
    <>
      {tiles.map((t) => (
        // eslint-disable-next-line @next/next/no-img-element -- 서버 프록시가 주는 동적 지도 조각(중심·줌이 매번 다름)이라 next/image 최적화 대상이 아니다.
        <img
          key={t.key}
          src={t.src}
          alt=""
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            left: `${(t.left / W) * 100}%`,
            top: `${(t.top / H) * 100}%`,
            width: `${(tileW / W) * 100}%`,
            height: `${(tileH / H) * 100}%`,
          }}
          draggable={false}
        />
      ))}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className={`absolute inset-0 h-full w-full ${onPick ? "cursor-crosshair" : ""}`}
        onClick={onPick ? handleClick : undefined}
        role={onPick ? "button" : undefined}
        aria-label={onPick ? "지도에서 지점 선택" : undefined}
      >
        {/* 경로선 — 흰 테두리를 깔아 어떤 지도 색 위에서도 보이게 한다.
            탐색 전(경로 없음)에는 그리지 않고 지점만 보여준다. */}
        {points.length > 1 ? (
          <>
            <polyline
              points={line}
              fill="none"
              stroke="#ffffff"
              strokeWidth={6}
              strokeOpacity={0.9}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <polyline
              points={line}
              fill="none"
              stroke="#ff2d55"
              strokeWidth={3.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </>
        ) : null}

        {/* 경유지 — 들르는 순서를 숫자로 */}
        {viaPx.map(([x, y], i) => (
          <g key={`via-${i}`}>
            <circle cx={x} cy={y} r={9} fill="#ffffff" />
            <circle cx={x} cy={y} r={7.5} fill="#f59e0b" />
            <text
              x={x}
              y={y + 3.5}
              textAnchor="middle"
              fontSize={10}
              fontWeight={700}
              fill="#ffffff"
            >
              {i + 1}
            </text>
          </g>
        ))}

        {startPx ? (
          <g>
            <circle cx={startPx[0]} cy={startPx[1]} r={7} fill="#ffffff" />
            <circle cx={startPx[0]} cy={startPx[1]} r={5} fill="#10b981" />
          </g>
        ) : null}
        {endPx ? (
          <g>
            <circle cx={endPx[0]} cy={endPx[1]} r={7} fill="#ffffff" />
            <circle cx={endPx[0]} cy={endPx[1]} r={5} fill="#ef4444" />
          </g>
        ) : null}
        {curPx ? (
          <g>
            <circle cx={curPx[0]} cy={curPx[1]} r={9} fill="#3b82f6" fillOpacity={0.25} />
            <circle cx={curPx[0]} cy={curPx[1]} r={5.5} fill="#ffffff" />
            <circle cx={curPx[0]} cy={curPx[1]} r={3.5} fill="#3b82f6" />
          </g>
        ) : null}
      </svg>
    </>
  );
}

export function RouteMap({
  path,
  bounds,
  current,
  startPoint,
  endPoint,
  viaPoints,
  onPick,
  className,
}: {
  /** 경로 폴리라인. 비어 있으면 선 없이 지점만 그린다(탐색 전 미리보기). */
  path: LonLat[];
  bounds: BBox;
  /** 현재 위치(경로에 스냅된 좌표). 없으면 표시하지 않는다. */
  current?: LonLat | null;
  /** 출발 지점(경로가 없을 때도 표시). 없으면 경로의 첫 점. */
  startPoint?: LonLat | null;
  /** 도착 지점(경로가 없을 때도 표시). 없으면 경로의 마지막 점. */
  endPoint?: LonLat | null;
  /** 경유지(들르는 순서대로). */
  viaPoints?: LonLat[];
  /** 주면 지도를 눌러 좌표를 고를 수 있다. */
  onPick?: (point: LonLat) => void;
  className?: string;
}) {
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const [box, setBox] = React.useState<Box | null>(null);

  React.useEffect(() => {
    const el = hostRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (!r || r.width < 2 || r.height < 2) return;
      const next = { w: Math.round(r.width), h: Math.round(r.height) };
      // 디바운스 — 드래그 리사이즈 도중 매 프레임 지도를 다시 받지 않도록.
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setBox(next), 180);
    });
    ro.observe(el);

    // 첫 측정은 즉시(디바운스를 기다리면 타일이 한 박자 늦게 뜬다).
    const r = el.getBoundingClientRect();
    if (r.width >= 2 && r.height >= 2) {
      setBox({ w: Math.round(r.width), h: Math.round(r.height) });
    }

    return () => {
      if (timer) clearTimeout(timer);
      ro.disconnect();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      className={`relative overflow-hidden rounded-md bg-muted/40 ${className ?? ""}`}
      data-pb-no-drag
    >
      {box ? (
        <MapLayers
          box={box}
          path={path}
          bounds={bounds}
          current={current}
          startPoint={startPoint}
          endPoint={endPoint}
          viaPoints={viaPoints}
          onPick={onPick}
        />
      ) : null}
    </div>
  );
}

export default RouteMap;
