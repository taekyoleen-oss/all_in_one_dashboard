"use client";

/**
 * RouteBody — 타일과 전체보기가 공유하는 본체(지도 + 고도 그래프 + 요약).
 *
 *  두 뷰의 차이는 `expanded` 하나뿐이다: 전체보기는 지도를 크게 쓰고 안내 지점
 *  목록을 덧붙이며, 현재 위치를 **watch**로 따라간다(타일은 1회 조회).
 *
 *  ── 위젯에서 바로 고치기 ──────────────────────────────────────────────────
 *  상단 요약의 출발·도착은 **버튼**이다. 누르면 그 자리에서 PlacePicker가 열려
 *  검색·최근 목록·현재 위치로 바꿀 수 있다(⋮ 편집을 거치지 않는다). 변경은
 *  `useSaveWidgetConfig`로 즉시 영속된다 — 길찾기는 걸으면서 쓰는 위젯이라
 *  다이얼로그를 여닫는 왕복이 특히 거슬린다.
 *
 *  상태를 조용히 삼키지 않는다 — 목적지 미설정·위치 권한 거부·서비스 지역 밖은
 *  각각 다른 문구로 알린다. 특히 지역 밖은 서버가 준 문구를 그대로 보여준다
 *  (티맵 보행자 경로는 전국이 아니다).
 */

import * as React from "react";
import {
  ArrowLeftRight,
  MapPin,
  Star,
  Navigation,
  History,
  Search,
  Play,
  Square,
  Crosshair,
  Plus,
  X,
  TriangleAlert,
} from "lucide-react";
import { useSaveWidgetConfig } from "@/lib/widgets/persistence";
import { useNow } from "@/lib/utils/useNow";
import {
  boundsOf,
  projectOntoPath,
  formatDistance,
  formatDuration,
  type BBox,
  type LonLat,
} from "@/lib/widgets/route/geo";
import { nextGuidance } from "@/lib/widgets/route/guidance";
import { isFavorite, loadFavorites } from "@/lib/widgets/route/favorites";
import { NextGuidance } from "./NextGuidance";
import { PlacePicker } from "./PlacePicker";
import { FavoritesPanel } from "./FavoritesPanel";
import { useAutoReroute } from "./useAutoReroute";
import { RouteMap } from "./RouteMap";
import { ElevationChart } from "./ElevationChart";
import { useWalkRoute } from "./useWalkRoute";
import { useCurrentPosition } from "./useCurrentPosition";
import { MAX_VIA, type RouteConfig, type RoutePlace } from "./types";

/** 경로에서 이만큼(m) 넘게 떨어지면 현재 위치를 경로 위에 찍지 않는다. */
const BASE_OFF_ROUTE_M = 50;

/** "3분 전" — 마지막 위치가 얼마나 묵었는지. */
function agoLabel(at: number, now: number): string {
  const mins = Math.max(0, Math.round((now - at) / 60_000));
  if (mins < 1) return "방금";
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.round(hours / 24)}일 전`;
}

function Notice({
  icon,
  title,
  detail,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  detail?: string | null;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 p-3 text-center">
      <span className="text-muted-foreground" aria-hidden>
        {icon}
      </span>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {detail ? (
        <p className="text-xs leading-snug text-muted-foreground">{detail}</p>
      ) : null}
      {action}
    </div>
  );
}

/** 요약 줄의 출발/도착 버튼 — 누르면 그 자리에서 바꾼다. */
function PlaceButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${label} — 눌러서 변경`}
      className="min-w-0 max-w-[45%] truncate rounded px-1 py-0.5 text-left font-medium text-foreground outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring"
    >
      {label}
    </button>
  );
}

export function RouteBody({
  config,
  instanceId,
  expanded = false,
}: {
  config: RouteConfig;
  instanceId: string;
  expanded?: boolean;
}) {
  const save = useSaveWidgetConfig();
  // "5분 전" 표시가 스스로 늙도록 1분마다 갱신(렌더 중 Date.now() 호출 금지 규칙도 지킨다).
  const now = useNow(60_000);
  const usesGps = config.start === null;
  /**
   * 실제로 길을 따라 걷는 중인가.
   *
   * 경로만 확인하려고 열어 보는 경우가 많은데(집에서 미리 찾아보기 등) 그때
   * "경로에서 벗어났습니다"가 뜨거나 경로가 저절로 다시 계산되면 방해만 된다.
   * 그래서 안내는 **명시적으로 시작**해야 켜진다. 전체보기를 닫으면 끝난다
   * — 걷는 동안만 유효한 상태라 저장하지 않는다.
   */
  const [navigating, setNavigating] = React.useState(false);
  /** 경유지 — config에 없을 수도 있어(구버전 위젯) 항상 배열로 다룬다. */
  const via = React.useMemo(() => config.via ?? [], [config.via]);
  /**
   * 지도를 눌러 지점을 고르는 중인가.
   * 'off'면 지도는 보기 전용 — 스크롤·드래그 중에 실수로 찍히지 않는다.
   */
  const [picking, setPicking] = React.useState<"start" | "end" | "via" | null>(
    null,
  );
  /** 열려 있는 패널(null이면 없음). */
  const [panel, setPanel] = React.useState<"start" | "end" | "favorites" | null>(
    null,
  );
  /** 즐겨찾기 목록은 패널을 열 때 읽지만, ★ 표시는 항상 최신이어야 한다. */
  const [favorites, setFavorites] = React.useState(loadFavorites);

  // 목적지가 있을 때만 위치를 요청한다 — 설정도 안 한 위젯이 권한 창을 띄우지 않도록.
  const gps = useCurrentPosition({
    enabled: Boolean(config.end),
    watch: expanded,
  });

  const origin: RoutePlace | null = React.useMemo(() => {
    if (config.start) return config.start;
    if (!gps.position) return null;
    return {
      label: gps.position.stale ? "마지막 위치" : "현재 위치",
      lat: gps.position.lat,
      lon: gps.position.lon,
    };
  }, [config.start, gps.position]);

  // 출발지 잠금을 풀고 현재 위치에서 다시 계산하기 위한 카운터('경로 다시 계산').
  const [searchKey, setSearchKey] = React.useState(0);
  const route = useWalkRoute(origin, config.end, via, config.avoidStairs, searchKey);

  const apply = React.useCallback(
    (next: RouteConfig) => save(instanceId, next),
    [save, instanceId],
  );

  // 현재 위치를 경로에 투영 — 지도 점과 고도 그래프의 세로선이 같은 값을 쓴다.
  const here = React.useMemo(() => {
    if (!route.data || !gps.position) return null;
    const p = projectOntoPath(route.data.path as LonLat[], [
      gps.position.lon,
      gps.position.lat,
    ]);
    // GPS 정확도가 나쁘면 그만큼 관대하게 본다(정확도 50m인데 40m 벗어났다고
    // 이탈로 단정하면 오판이다).
    const limit = Math.max(BASE_OFF_ROUTE_M, gps.position.accuracy);
    return { ...p, onRoute: p.offset <= limit };
  }, [route.data, gps.position]);

  // 다음 안내(요구 2) — 경로를 다시 부르지 않고, 투영된 거리로만 다시 계산한다.
  const guide = React.useMemo(() => {
    if (!route.data || !here) return null;
    return nextGuidance(
      route.data.steps,
      here.distanceAlong,
      route.data.totalDistance,
    );
  }, [route.data, here]);

  // 탐색 전 미리보기용 좌표 — 지도가 '지금 고른 지점'을 즉시 보여주기 위한 것.
  const originPoint: LonLat | null = origin ? [origin.lon, origin.lat] : null;
  const endPoint: LonLat | null = config.end
    ? [config.end.lon, config.end.lat]
    : null;
  /** 출발·도착 두 점을 담는 범위(한쪽만 있으면 그 점 하나 — fitView가 넓혀준다). */
  const previewBounds: BBox = React.useMemo(() => {
    const pts = [originPoint, endPoint].filter((p): p is LonLat => p !== null);
    return (
      boundsOf(pts) ?? { west: 126.978, south: 37.5665, east: 126.978, north: 37.5665 }
    );
    // 좌표 값이 바뀔 때만 다시 계산한다(배열 아이덴티티는 매 렌더 달라진다).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originPoint?.[0], originPoint?.[1], endPoint?.[0], endPoint?.[1]]);

  // 지금 설정이 화면의 경로와 다른가 — 다르면 '탐색'을 눌러야 한다.
  // (출발·도착을 바꿔도 경로를 자동으로 다시 부르지 않는다. useWalkRoute 주석 참고)
  const samePlace = (a: RoutePlace | null, b: RoutePlace | null) =>
    a === b || (!!a && !!b && a.lat === b.lat && a.lon === b.lon);
  const sameVia = (a: RoutePlace[], b: RoutePlace[]) =>
    a.length === b.length && a.every((p, i) => samePlace(p, b[i]));
  const needsSearch =
    route.searched === null ||
    !samePlace(route.searched.end, config.end) ||
    !sameVia(route.searched.via, via) ||
    route.searched.avoidStairs !== config.avoidStairs ||
    // 출발지는 '현재 위치'면 좌표가 계속 바뀌므로 지정 출발지일 때만 비교한다.
    (config.start !== null && !samePlace(route.searched.start, config.start));

  // 이탈이 이어지면 스스로 다시 찾는다(자동 재검색 + 취소).
  // 출발지가 '현재 위치'일 때만 결과가 달라지므로 그때만 켠다.
  const auto = useAutoReroute({
    offRoute: Boolean(here && !here.onRoute),
    // 안내 중일 때만 — 경로를 훑어보는 중에 저절로 다시 계산되면 안 된다.
    enabled: usesGps && navigating,
    onReroute: () => setSearchKey((n) => n + 1),
  });

  const saved = isFavorite(
    favorites,
    config.start,
    config.end,
    config.avoidStairs,
  );

  /**
   * 지도에서 찍은 좌표를 지점으로 만든다.
   * 이름은 역지오코딩(/api/geocode?lat=&lon=)으로 붙이고, 실패하면 좌표를 쓴다
   * — 이름을 못 얻었다고 선택 자체를 버리지 않는다.
   */
  const placeFromMap = async (point: LonLat): Promise<RoutePlace> => {
    const [lon, lat] = point;
    const fallback = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    try {
      // 응답은 { result: { label, detail } | null } — 좌표가 KR 밖이거나 조회에
      // 실패하면 result가 null이다.
      const res = await fetch(`/api/geocode?lat=${lat}&lon=${lon}`);
      const json = (await res.json()) as {
        result?: { label?: unknown } | null;
      };
      const label = json.result?.label;
      return {
        label: typeof label === "string" && label.trim() ? label.trim() : fallback,
        lat,
        lon,
      };
    } catch {
      return { label: fallback, lat, lon };
    }
  };

  const handleMapPick = async (point: LonLat) => {
    const target = picking;
    if (!target) return;
    setPicking(null);
    const place = await placeFromMap(point);
    if (target === "start") apply({ ...config, start: place });
    else if (target === "end") apply({ ...config, end: place });
    else apply({ ...config, via: [...via, place].slice(0, MAX_VIA) });
  };

  /** 피커에서 한 곳을 골랐을 때. */
  const pickPlace = (which: "start" | "end", place: RoutePlace) => {
    apply({ ...config, [which]: place });
    setPanel(null);
  };

  /** 패널을 닫을 때 즐겨찾기 ★ 표시를 최신으로 맞춘다. */
  const closePanel = () => {
    setFavorites(loadFavorites());
    setPanel(null);
  };

  const picker =
    panel === null ? null : panel === "favorites" ? (
      <FavoritesPanel
        config={config}
        saved={saved}
        onLoad={(next) => apply(next)}
        onClose={closePanel}
      />
    ) : (
      <PlacePicker
        title={panel === "start" ? "출발지" : "도착지"}
        allowCurrent={panel === "start"}
        onPick={(place) => pickPlace(panel, place)}
        onUseCurrent={() => apply({ ...config, start: null })}
        onClose={closePanel}
      />
    );

  /* ── 안내가 필요한 상태들 ─────────────────────────────────────────────── */

  if (!config.end) {
    return (
      <div className="relative h-full w-full">
        <Notice
          icon={<MapPin size={20} />}
          title="도착지를 설정하세요"
          detail="도착지를 정하면 도보 경로와 고도가 표시됩니다."
          action={
            <button
              type="button"
              onClick={() => setPanel("end")}
              className="mt-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
            >
              도착지 정하기
            </button>
          }
        />
        {picker}
      </div>
    );
  }
  if (usesGps && gps.error) {
    return (
      <div className="relative h-full w-full">
        <Notice
          icon={<TriangleAlert size={20} />}
          title="위치를 사용할 수 없음"
          detail={gps.error}
          action={
            <button
              type="button"
              onClick={() => setPanel("start")}
              className="mt-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring"
            >
              출발지 직접 지정
            </button>
          }
        />
        {picker}
      </div>
    );
  }
  if (!origin) {
    return (
      <div className="relative h-full w-full">
        <Notice icon={<Navigation size={20} />} title="현재 위치 확인 중…" />
        {picker}
      </div>
    );
  }
  if (route.loading) {
    return (
      <div className="relative h-full w-full">
        <Notice icon={<Navigation size={20} />} title="도보 경로를 찾는 중…" />
        {picker}
      </div>
    );
  }
  if (route.error && !route.data) {
    // 직전 탐색이 실패한 뒤 지점을 바꿨다면 지금 필요한 건 오류 안내가 아니라
    // '탐색'이다 — 이걸 빠뜨리면 오류 화면에 갇혀 다시 시도할 방법이 없다.
    return (
      <div className="relative h-full w-full">
        <Notice
          icon={
            needsSearch ? <Search size={20} /> : <TriangleAlert size={20} />
          }
          title={needsSearch ? "탐색을 누르세요" : "경로를 표시할 수 없음"}
          detail={
            needsSearch
              ? "출발·도착이 정해졌습니다. 탐색하면 경로와 고도를 계산합니다."
              : // 서버가 이유를 아는 경우(지역 밖·키 미설정 등)엔 그 문구가 정확하다.
                (route.message ?? "잠시 후 다시 시도해 주세요.")
          }
          action={
            <div className="mt-1 flex items-center gap-1.5">
              {needsSearch ? (
                <button
                  type="button"
                  onClick={() => setSearchKey((n) => n + 1)}
                  className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Search size={13} aria-hidden />
                  탐색
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setPanel("end")}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring"
              >
                다른 도착지 선택
              </button>
            </div>
          }
        />
        {picker}
      </div>
    );
  }
  if (!route.data) return null;

  const data = route.data;
  const staleAt = gps.position?.stale ? gps.position.at : null;

  return (
    <div
      className={`relative flex h-full w-full flex-col gap-1.5 ${
        // 전체보기는 지도가 주인공이라 최소 높이를 보장하고, 그래도 안 들어가면
        // 세로로 스크롤한다(짧은 화면에서 지도가 찌그러지던 문제).
        expanded ? "overflow-y-auto pb-scroll" : ""
      }`}
    >
      {/* 요약 — 출발·도착은 눌러서 바로 바꿀 수 있다 */}
      <div className="flex shrink-0 items-center gap-0.5 text-xs">
        <Navigation size={12} aria-hidden className="mr-1 shrink-0 text-primary" />
        <PlaceButton label={origin.label} onClick={() => setPanel("start")} />
        <span className="shrink-0 text-muted-foreground">→</span>
        <PlaceButton label={config.end.label} onClick={() => setPanel("end")} />
        <button
          type="button"
          // 출발지가 '현재 위치'면 그 좌표를 굳혀서 도착지로 삼는다(돌아가기).
          // 라벨은 '출발 지점'으로 바꾼다 — 굳은 좌표에 "현재 위치"라는 이름을
          // 남기면 "현재 위치 → 현재 위치"가 되어 뜻이 통하지 않는다.
          onClick={() =>
            apply({
              ...config,
              start: config.end,
              end: usesGps ? { ...origin, label: "출발 지점" } : origin,
            })
          }
          aria-label="출발지와 도착지 맞바꾸기"
          title="출발지와 도착지 맞바꾸기"
          className="ml-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground outline-none transition-colors hover:bg-accent/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:size-8"
        >
          <ArrowLeftRight size={12} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => setPanel("favorites")}
          aria-label={saved ? "즐겨찾기 경로 (저장됨)" : "즐겨찾기 경로"}
          title={saved ? "즐겨찾기에 저장된 경로" : "즐겨찾기 경로 저장·불러오기"}
          className={`inline-flex size-6 shrink-0 items-center justify-center rounded outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:size-8 ${
            saved ? "text-primary" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Star size={12} aria-hidden fill={saved ? "currentColor" : "none"} />
        </button>
        {needsSearch ? (
          <button
            type="button"
            onClick={() => setSearchKey((n) => n + 1)}
            className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:px-3 pointer-coarse:py-1.5"
          >
            <Search size={12} aria-hidden />
            탐색
          </button>
        ) : (
          <span className="ml-auto shrink-0 font-mono tabular-nums text-muted-foreground">
            {formatDistance(data.totalDistance)} · {formatDuration(data.totalTime)}
          </span>
        )}
      </div>

      {/* 경유지 — 순서대로 들른다. 칩을 눌러 뺀다. */}
      {via.length > 0 ? (
        <div className="flex shrink-0 flex-wrap items-center gap-1 text-[11px]">
          <span className="text-muted-foreground">경유</span>
          {via.map((p, i) => (
            <span
              key={`${p.lat},${p.lon},${i}`}
              className="inline-flex max-w-[45%] items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 py-0.5 pl-2 pr-1"
            >
              <span className="font-mono text-[10px] text-amber-600 dark:text-amber-400">
                {i + 1}
              </span>
              <span className="truncate text-foreground">{p.label}</span>
              <button
                type="button"
                onClick={() =>
                  apply({ ...config, via: via.filter((_, j) => j !== i) })
                }
                aria-label={`경유지 ${p.label} 삭제`}
                className="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-destructive/20 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:size-6"
              >
                <X size={10} aria-hidden />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {/* 지도에서 지점 고르기 — 누르고 지도를 탭한다. */}
      <div className="flex shrink-0 flex-wrap items-center gap-1 text-[11px]">
        {picking ? (
          <>
            <span className="inline-flex items-center gap-1 rounded-md border border-primary/50 bg-primary/10 px-2 py-1 font-medium text-primary">
              <Crosshair size={11} aria-hidden />
              지도를 눌러{" "}
              {picking === "start" ? "출발지" : picking === "end" ? "도착지" : "경유지"}
              를 지정하세요
            </span>
            <button
              type="button"
              onClick={() => setPicking(null)}
              className="rounded-md border border-border px-2 py-1 text-muted-foreground outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring"
            >
              취소
            </button>
          </>
        ) : (
          <>
            <span className="text-muted-foreground">지도에서 지정:</span>
            {(["start", "end"] as const).map((which) => (
              <button
                key={which}
                type="button"
                onClick={() => setPicking(which)}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-foreground outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:py-1.5"
              >
                <Crosshair size={11} aria-hidden />
                {which === "start" ? "출발" : "도착"}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPicking("via")}
              disabled={via.length >= MAX_VIA}
              title={
                via.length >= MAX_VIA
                  ? `경유지는 최대 ${MAX_VIA}개입니다`
                  : "지도를 눌러 경유지 추가"
              }
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-foreground outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 pointer-coarse:py-1.5"
            >
              <Plus size={11} aria-hidden />
              경유지{via.length > 0 ? ` (${via.length}/${MAX_VIA})` : ""}
            </button>
          </>
        )}
      </div>

      {/* 마지막 위치로 버티는 중이면 반드시 밝힌다 — 옛 좌표를 현재인 척하지 않는다 */}
      {staleAt !== null ? (
        <p className="flex shrink-0 items-center gap-1 rounded-md border border-border bg-accent/30 px-2 py-1 text-[11px] text-muted-foreground">
          <History size={11} aria-hidden className="shrink-0" />
          현재 위치를 못 잡아 <strong className="font-medium">마지막 위치</strong>
          ({agoLabel(staleAt, now.getTime())})를 쓰는 중입니다
        </p>
      ) : null}

      {/* 다음 안내(요구 2) — 전체보기에서 현재 위치를 따라가며 갱신된다. */}
      {expanded && !needsSearch ? (
        navigating ? (
          <div className="flex shrink-0 flex-col gap-1">
            {guide ? (
              <NextGuidance
                step={guide.step}
                toStep={guide.toStep}
                toEnd={guide.toEnd}
                arrived={guide.arrived}
                offRouteBy={here && !here.onRoute ? here.offset : null}
                onReroute={() => setSearchKey((n) => n + 1)}
                canReroute={usesGps}
                autoPending={auto.pending}
                onCancelAuto={auto.cancel}
              />
            ) : (
              <p className="rounded-md border border-border bg-accent/30 px-3 py-2 text-xs text-muted-foreground">
                현재 위치를 확인하는 중입니다…
              </p>
            )}
            <button
              type="button"
              onClick={() => setNavigating(false)}
              className="self-end inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground outline-none transition-colors hover:bg-accent/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:py-1.5"
            >
              <Square size={10} aria-hidden />
              안내 종료
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setNavigating(true)}
            className="flex shrink-0 items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Play size={14} aria-hidden />
            안내 시작
          </button>
        )
      ) : null}

      {/* 지도 — 남는 세로 공간을 전부 쓴다 */}
      <RouteMap
        path={needsSearch ? [] : (data.path as LonLat[])}
        bounds={needsSearch ? previewBounds : data.bounds}
        current={!needsSearch && here?.onRoute ? (here.snapped as LonLat) : null}
        startPoint={needsSearch ? originPoint : null}
        endPoint={needsSearch ? endPoint : null}
        viaPoints={via.map((p) => [p.lon, p.lat] as LonLat)}
        onPick={picking ? (pt) => void handleMapPick(pt) : undefined}
        className={expanded ? "min-h-[260px] flex-1" : "min-h-0 flex-1"}
      />

      {/* 탐색 전이면 지금 보이는 건 '지점 미리보기'라는 사실을 밝힌다 */}
      {needsSearch ? (
        <p className="shrink-0 rounded-md border border-primary/40 bg-primary/5 px-2 py-1 text-[11px] text-muted-foreground">
          출발·도착이 바뀌었습니다. <strong className="font-medium text-foreground">탐색</strong>을
          누르면 경로와 고도를 다시 계산합니다.
        </p>
      ) : null}

      {/* 고도 그래프 */}
      {!needsSearch && data.elevation.length > 1 ? (
        <ElevationChart
          points={data.elevation}
          currentDistance={here?.onRoute ? here.distanceAlong : null}
          source={data.elevationSource}
          className={expanded ? "h-28 shrink-0" : "h-20 shrink-0"}
        />
      ) : null}

      {/* 전체보기: 안내 지점 목록 */}
      {expanded && !needsSearch ? (
        <ol className="max-h-40 shrink-0 overflow-y-auto pb-scroll text-xs">
          {data.steps.map((s) => (
            <li
              key={s.index}
              className="flex items-baseline gap-2 border-t border-border/60 py-1 first:border-t-0"
            >
              <span className="shrink-0 font-mono tabular-nums text-[10px] text-muted-foreground">
                {formatDistance(s.distanceFromStart)}
              </span>
              <span className="min-w-0 flex-1 text-foreground">
                {s.description || s.name || "—"}
              </span>
            </li>
          ))}
        </ol>
      ) : null}

      {picker}
    </div>
  );
}

export default RouteBody;
