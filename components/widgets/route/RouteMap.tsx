"use client";

/**
 * RouteMap — 티맵 지도 이미지 위에 경로선·마커를 SVG로 겹친다.
 *
 *  지도는 `/api/map/static` 프록시가 주는 PNG(앱 키는 서버 안에 머문다). StaticMap은
 *  경로선을 그려주지 않으므로 폴리라인·핀·현재위치는 전부 여기서 SVG로 그린다.
 *
 *  ⚠ 좌표 변환은 반드시 `geo.ts`의 project()/toPixel()을 쓴다 — 티맵 이미지는 표준
 *    Web Mercator의 **2배 축척**(512px 타일)이라 표준 공식을 쓰면 선이 2배 어긋난다.
 *
 *  크기 처리: 컨테이너를 ResizeObserver로 재고 **가로세로 비율을 유지한 채** 512
 *  이내로 줄여 이미지를 요청한다. SVG viewBox를 같은 논리 크기로 맞추면 이미지와
 *  오버레이가 언제나 같은 배율로 늘어나 어긋나지 않는다. 크기 변화는 디바운스해
 *  드래그 리사이즈 도중 지도를 매 프레임 다시 받지 않는다(요청 수 = 무료 한도).
 */

import * as React from "react";
import { fitView, toPixel, type BBox, type LonLat } from "@/lib/widgets/route/geo";

/** StaticMap이 돌려줄 수 있는 한 변의 최대 픽셀(공식 문서). */
const MAX_IMAGE_SIZE = 512;
/** 경로가 가장자리에 붙지 않도록 남기는 여백(논리 px). */
const FIT_PADDING = 20;

interface Box {
  w: number;
  h: number;
}

/** 컨테이너 크기 → 요청할 이미지 크기(비율 유지, 512 이내). */
function imageBox({ w, h }: Box): Box {
  const scale = Math.min(1, MAX_IMAGE_SIZE / Math.max(w, h));
  return {
    w: Math.max(1, Math.round(w * scale)),
    h: Math.max(1, Math.round(h * scale)),
  };
}

function MapLayers({
  box,
  path,
  bounds,
  current,
  startPoint,
  endPoint,
}: {
  box: Box;
  path: LonLat[];
  bounds: BBox;
  current?: LonLat | null;
  startPoint?: LonLat | null;
  endPoint?: LonLat | null;
}) {
  const img = imageBox(box);
  const view = fitView(bounds, img.w, img.h, FIT_PADDING);
  const src = `/api/map/static?lat=${view.center[1].toFixed(6)}&lon=${view.center[0].toFixed(
    6,
  )}&zoom=${view.zoom}&w=${img.w}&h=${img.h}`;

  const points = path.map((p) => toPixel(p, view, img.w, img.h));
  const line = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  // 마커는 명시 지점이 있으면 그것을, 없으면 경로의 양 끝을 쓴다 — 아직 탐색하지
  // 않은 미리보기에서도 출발·도착이 보여야 한다.
  const startSrc = startPoint ?? path[0] ?? null;
  const endSrc = endPoint ?? path[path.length - 1] ?? null;
  const startPx = startSrc ? toPixel(startSrc, view, img.w, img.h) : null;
  const endPx = endSrc ? toPixel(endSrc, view, img.w, img.h) : null;
  const curPx = current ? toPixel(current, view, img.w, img.h) : null;

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- 서버 프록시가 주는 동적 지도 타일(크기·중심이 매번 다름)이라 next/image의 최적화 대상이 아니다. */}
      <img
        src={src}
        alt="도보 경로 지도"
        width={img.w}
        height={img.h}
        className="absolute inset-0 h-full w-full object-fill"
        draggable={false}
      />
      <svg
        viewBox={`0 0 ${img.w} ${img.h}`}
        className="absolute inset-0 h-full w-full"
        aria-hidden
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
    >
      {box ? (
        <MapLayers
          box={box}
          path={path}
          bounds={bounds}
          current={current}
          startPoint={startPoint}
          endPoint={endPoint}
        />
      ) : null}
    </div>
  );
}

export default RouteMap;
