"use client";

/**
 * LocationPicker — 위치(라벨 + 위도/경도)를 고르는 공용 ConfigEditor 조각.
 *
 *  날씨 위젯의 위치 설정 UX를 위젯 간에 재사용하기 위한 컴포넌트. 위치를 쓰는 여러
 *  위젯(대기질·일출/달 등)이 같은 4가지 방법으로 위치를 지정한다:
 *    1. 주소·장소 검색 (/api/geocode — 동 단위 주소·골프장·랜드마크 → 좌표)
 *    2. 현재 위치 (navigator.geolocation → lat/lon)
 *    3. 지역 선택 (작은 큐레이션 도시 목록)
 *    4. 직접 입력 (라벨 + 위도/경도)
 *
 *  순수 컨트롤드: 위치가 정해질 때마다 `onPick({label,lat,lon})`을 호출한다(상위가
 *  자신의 config에 합쳐 영속화). 날씨 위젯과 달리 표시 옵션 등은 다루지 않는다 —
 *  오직 위치만. geolocation은 명시적 버튼 뒤에 있고 거부돼도 우아하게 폴백한다.
 */

import * as React from "react";
import { LocateFixed, MapPin, Search } from "lucide-react";

export interface LocationValue {
  label: string;
  lat: number;
  lon: number;
}

/** 국내 도시(구·도 단위) — 직접 입력/현재위치 없이 빠르게 고를 때. */
export const KOREA_CITIES: ReadonlyArray<LocationValue> = [
  { label: "서울", lat: 37.5665, lon: 126.978 },
  { label: "부산", lat: 35.1796, lon: 129.0756 },
  { label: "인천", lat: 37.4563, lon: 126.7052 },
  { label: "대구", lat: 35.8714, lon: 128.6014 },
  { label: "대전", lat: 36.3504, lon: 127.3845 },
  { label: "광주", lat: 35.1595, lon: 126.8526 },
  { label: "울산", lat: 35.5384, lon: 129.3114 },
  { label: "세종", lat: 36.48, lon: 127.289 },
  { label: "수원", lat: 37.2636, lon: 127.0286 },
  { label: "성남", lat: 37.4201, lon: 127.1262 },
  { label: "춘천", lat: 37.8813, lon: 127.7298 },
  { label: "강릉", lat: 37.7519, lon: 128.8761 },
  { label: "청주", lat: 36.6424, lon: 127.489 },
  { label: "천안", lat: 36.8151, lon: 127.1139 },
  { label: "전주", lat: 35.8242, lon: 127.148 },
  { label: "여수", lat: 34.7604, lon: 127.6622 },
  { label: "포항", lat: 36.019, lon: 129.3435 },
  { label: "창원", lat: 35.2278, lon: 128.6817 },
  { label: "제주", lat: 33.4996, lon: 126.5312 },
];

/** 기본 빠른선택 목록(국내 + 도쿄·뉴욕) — air-quality 등 단일 목록 위젯의 기본값. */
export const LOCATION_CITIES: ReadonlyArray<LocationValue> = [
  ...KOREA_CITIES,
  { label: "도쿄", lat: 35.6762, lon: 139.6503 },
  { label: "뉴욕", lat: 40.7128, lon: -74.006 },
];

/** 세계 주요 도시(서로 다른 시간대·반구) — 일출/일몰·달처럼 전 지구적 위젯의 '해외' 탭. */
export const WORLD_CITIES: ReadonlyArray<LocationValue> = [
  { label: "도쿄", lat: 35.6762, lon: 139.6503 },
  { label: "뉴욕", lat: 40.7128, lon: -74.006 },
  { label: "베이징", lat: 39.9042, lon: 116.4074 },
  { label: "상하이", lat: 31.2304, lon: 121.4737 },
  { label: "홍콩", lat: 22.3193, lon: 114.1694 },
  { label: "타이베이", lat: 25.033, lon: 121.5654 },
  { label: "싱가포르", lat: 1.3521, lon: 103.8198 },
  { label: "방콕", lat: 13.7563, lon: 100.5018 },
  { label: "하노이", lat: 21.0278, lon: 105.8342 },
  { label: "마닐라", lat: 14.5995, lon: 120.9842 },
  { label: "뉴델리", lat: 28.6139, lon: 77.209 },
  { label: "두바이", lat: 25.2048, lon: 55.2708 },
  { label: "이스탄불", lat: 41.0082, lon: 28.9784 },
  { label: "모스크바", lat: 55.7558, lon: 37.6173 },
  { label: "런던", lat: 51.5074, lon: -0.1278 },
  { label: "파리", lat: 48.8566, lon: 2.3522 },
  { label: "베를린", lat: 52.52, lon: 13.405 },
  { label: "로마", lat: 41.9028, lon: 12.4964 },
  { label: "마드리드", lat: 40.4168, lon: -3.7038 },
  { label: "LA", lat: 34.0522, lon: -118.2437 },
  { label: "샌프란시스코", lat: 37.7749, lon: -122.4194 },
  { label: "시카고", lat: 41.8781, lon: -87.6298 },
  { label: "토론토", lat: 43.6532, lon: -79.3832 },
  { label: "밴쿠버", lat: 49.2827, lon: -123.1207 },
  { label: "멕시코시티", lat: 19.4326, lon: -99.1332 },
  { label: "상파울루", lat: -23.5505, lon: -46.6333 },
  { label: "시드니", lat: -33.8688, lon: 151.2093 },
  { label: "오클랜드", lat: -36.8485, lon: 174.7633 },
  { label: "호놀룰루", lat: 21.3069, lon: -157.8583 },
  { label: "카이로", lat: 30.0444, lon: 31.2357 },
];

/** /api/geocode 한 건(서버 모듈을 번들하지 않도록 로컬 타입). */
interface GeoHit {
  label: string;
  detail: string;
  lat: number;
  lon: number;
}

export interface CityGroup {
  label: string;
  cities: ReadonlyArray<LocationValue>;
}

export function LocationPicker({
  value,
  onPick,
  cities = LOCATION_CITIES,
  cityGroups,
}: {
  value: LocationValue;
  onPick: (next: LocationValue) => void;
  /** Single quick-pick city list (default). Ignored when `cityGroups` is set. */
  cities?: ReadonlyArray<LocationValue>;
  /** Tabbed quick-pick groups (e.g. 국내/해외). First group is the default tab. */
  cityGroups?: CityGroup[];
}) {
  const [activeGroup, setActiveGroup] = React.useState(0);
  const shownCities = cityGroups
    ? cityGroups[activeGroup]?.cities ?? []
    : cities;
  const [labelInput, setLabelInput] = React.useState(value.label);
  const [latInput, setLatInput] = React.useState(String(value.lat));
  const [lonInput, setLonInput] = React.useState(String(value.lon));
  const [geoState, setGeoState] = React.useState<"idle" | "locating" | "error">(
    "idle",
  );
  const [err, setErr] = React.useState<string | null>(null);

  const [placeQuery, setPlaceQuery] = React.useState("");
  const [places, setPlaces] = React.useState<GeoHit[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [searchErr, setSearchErr] = React.useState<string | null>(null);

  const runSearch = async () => {
    const q = placeQuery.trim();
    if (q.length < 2) {
      setSearchErr("두 글자 이상 입력하세요.");
      return;
    }
    setSearching(true);
    setSearchErr(null);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      const json = (await res.json()) as { results?: GeoHit[] };
      const list = Array.isArray(json.results) ? json.results : [];
      setPlaces(list);
      if (list.length === 0) setSearchErr("검색 결과가 없습니다.");
    } catch {
      setSearchErr("검색에 실패했습니다. 잠시 후 다시 시도하세요.");
    } finally {
      setSearching(false);
    }
  };

  const pick = (loc: LocationValue) => {
    const lat = Number(loc.lat.toFixed(4));
    const lon = Number(loc.lon.toFixed(4));
    setLabelInput(loc.label);
    setLatInput(String(lat));
    setLonInput(String(lon));
    setErr(null);
    onPick({ label: loc.label, lat, lon });
  };

  const useCurrentLocation = () => {
    setErr(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoState("error");
      setErr("이 브라우저는 위치 정보를 지원하지 않습니다.");
      return;
    }
    setGeoState("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoState("idle");
        pick({
          label: "현재 위치",
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        });
      },
      () => {
        setGeoState("error");
        setErr("위치 권한이 거부되었거나 위치를 가져오지 못했습니다.");
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 },
    );
  };

  const applyManual = () => {
    const lat = Number(latInput);
    const lon = Number(lonInput);
    const label = labelInput.trim();
    if (!label) {
      setErr("위치 이름을 입력하세요.");
      return;
    }
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      setErr("위도는 -90 ~ 90 사이의 숫자여야 합니다.");
      return;
    }
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
      setErr("경도는 -180 ~ 180 사이의 숫자여야 합니다.");
      return;
    }
    setErr(null);
    onPick({ label, lat: Number(lat.toFixed(4)), lon: Number(lon.toFixed(4)) });
  };

  const isActive = (loc: { lat: number; lon: number }) =>
    Math.abs(loc.lat - value.lat) < 1e-3 && Math.abs(loc.lon - value.lon) < 1e-3;

  return (
    <div className="flex flex-col gap-4">
      {/* 현재 위치 표시 */}
      <div className="flex items-center gap-2 rounded-md border border-border bg-background/40 px-3 py-2 text-sm">
        <MapPin size={15} aria-hidden className="shrink-0 text-primary" />
        <span className="truncate font-medium text-foreground">
          {value.label || "위치 미설정"}
        </span>
        <span className="ml-auto shrink-0 font-mono text-[11px] text-muted-foreground">
          {value.lat.toFixed(3)}, {value.lon.toFixed(3)}
        </span>
      </div>

      {/* 주소·장소 검색 */}
      <fieldset className="flex flex-col gap-2 rounded-md border border-border p-3">
        <legend className="px-1 text-xs font-medium text-muted-foreground">
          주소·장소 검색
        </legend>
        <div className="flex gap-2">
          <input
            value={placeQuery}
            onChange={(e) => {
              setPlaceQuery(e.target.value);
              setSearchErr(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void runSearch();
              }
            }}
            placeholder="예: 역삼동, 분당구 정자동, 해운대"
            className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="button"
            onClick={() => void runSearch()}
            disabled={searching}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <Search size={15} aria-hidden />
            {searching ? "검색 중…" : "검색"}
          </button>
        </div>
        {searchErr ? <p className="text-xs text-destructive">{searchErr}</p> : null}
        {places.length > 0 ? (
          <ul className="flex max-h-52 flex-col gap-1 overflow-y-auto pb-scroll">
            {places.map((p, i) => (
              <li key={`${p.lat},${p.lon},${i}`}>
                <button
                  type="button"
                  onClick={() => pick(p)}
                  aria-pressed={isActive(p)}
                  className={[
                    "flex w-full flex-col items-start gap-0.5 rounded-md border px-2 py-1.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    isActive(p)
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-accent/40",
                  ].join(" ")}
                >
                  <span className="text-sm font-medium text-foreground">
                    {p.label}
                  </span>
                  {p.detail ? (
                    <span className="truncate text-[11px] text-muted-foreground">
                      {p.detail}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </fieldset>

      {/* 현재 위치 */}
      <fieldset className="flex flex-col gap-2 rounded-md border border-border p-3">
        <legend className="px-1 text-xs font-medium text-muted-foreground">
          현재 위치
        </legend>
        <button
          type="button"
          onClick={useCurrentLocation}
          disabled={geoState === "locating"}
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          <LocateFixed size={15} aria-hidden />
          {geoState === "locating" ? "위치 확인 중…" : "현재 위치 사용"}
        </button>
      </fieldset>

      {/* 지역 선택 */}
      <fieldset className="flex flex-col gap-2 rounded-md border border-border p-3">
        <legend className="px-1 text-xs font-medium text-muted-foreground">
          지역 선택
        </legend>
        {cityGroups ? (
          <div className="flex gap-1">
            {cityGroups.map((g, i) => {
              const active = i === activeGroup;
              return (
                <button
                  key={g.label}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setActiveGroup(i)}
                  className={[
                    "rounded-md border px-3 py-1 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:bg-accent/40",
                  ].join(" ")}
                >
                  {g.label}
                </button>
              );
            })}
          </div>
        ) : null}
        <div className="grid grid-cols-3 gap-1.5">
          {shownCities.map((city) => (
            <button
              key={city.label}
              type="button"
              aria-pressed={isActive(city)}
              onClick={() => pick(city)}
              className={[
                "inline-flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                isActive(city)
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-foreground hover:bg-accent/40",
              ].join(" ")}
            >
              <MapPin size={14} aria-hidden className="shrink-0" />
              <span className="truncate">{city.label}</span>
            </button>
          ))}
        </div>
      </fieldset>

      {/* 직접 입력 */}
      <fieldset className="flex flex-col gap-2 rounded-md border border-border p-3">
        <legend className="px-1 text-xs font-medium text-muted-foreground">
          직접 입력
        </legend>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          위치 이름
          <input
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            placeholder="우리집"
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            위도 (lat)
            <input
              value={latInput}
              onChange={(e) => setLatInput(e.target.value)}
              inputMode="decimal"
              placeholder="37.5665"
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            경도 (lon)
            <input
              value={lonInput}
              onChange={(e) => setLonInput(e.target.value)}
              inputMode="decimal"
              placeholder="126.978"
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
        </div>
        {err ? <p className="text-xs text-destructive">{err}</p> : null}
        <button
          type="button"
          onClick={applyManual}
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring"
        >
          위치 적용
        </button>
      </fieldset>
    </div>
  );
}

export default LocationPicker;
