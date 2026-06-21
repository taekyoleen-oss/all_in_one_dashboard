"use client";

/**
 * 외출옷 추천 · ConfigEditor — 위치·성별·활동·체감 보정·기본 시간대 설정.
 *
 *  위치는 날씨 위젯과 동일하게 /api/geocode 검색(동 주소·골프장 등) + 현재 위치 +
 *  도시 선택 + 직접 입력으로 지정한다. 성별/활동/체감 보정/기본 시간대를 선택한다.
 */

import * as React from "react";
import { LocateFixed, MapPin, Search } from "lucide-react";
import type { ConfigEditorProps } from "@/lib/widgets/contract";
import type { OutfitConfig } from "./types";
import type { ActivityType, GenderType } from "./illustration/types";
import {
  ACTIVITIES,
  OUTFIT_PERIODS,
  SENSITIVITY_OPTIONS,
} from "./constants";

interface GeoHit {
  label: string;
  detail: string;
  lat: number;
  lon: number;
}

const COMMON_CITIES: Array<{ label: string; lat: number; lon: number }> = [
  { label: "서울", lat: 37.5665, lon: 126.978 },
  { label: "부산", lat: 35.1796, lon: 129.0756 },
  { label: "인천", lat: 37.4563, lon: 126.7052 },
  { label: "대구", lat: 35.8714, lon: 128.6014 },
  { label: "대전", lat: 36.3504, lon: 127.3845 },
  { label: "광주", lat: 35.1595, lon: 126.8526 },
  { label: "수원", lat: 37.2636, lon: 127.0286 },
  { label: "춘천", lat: 37.8813, lon: 127.7298 },
  { label: "강릉", lat: 37.7519, lon: 128.8761 },
  { label: "전주", lat: 35.8242, lon: 127.148 },
  { label: "포항", lat: 36.019, lon: 129.3435 },
  { label: "제주", lat: 33.4996, lon: 126.5312 },
];

const GENDERS: { id: GenderType; label: string; icon: string }[] = [
  { id: "male", label: "남성", icon: "👨" },
  { id: "female", label: "여성", icon: "👩" },
];

const chipClass = (active: boolean) =>
  [
    "inline-flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
    active
      ? "border-primary bg-primary/10 text-foreground"
      : "border-border text-foreground hover:bg-accent/40",
  ].join(" ");

export function OutfitConfigEditor({
  config,
  onChange,
}: ConfigEditorProps<OutfitConfig>) {
  const [labelInput, setLabelInput] = React.useState(config.label);
  const [latInput, setLatInput] = React.useState(String(config.lat));
  const [lonInput, setLonInput] = React.useState(String(config.lon));
  const [err, setErr] = React.useState<string | null>(null);
  const [geoState, setGeoState] = React.useState<"idle" | "locating" | "error">(
    "idle",
  );

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

  const setLocation = (loc: { label: string; lat: number; lon: number }) => {
    setLabelInput(loc.label);
    setLatInput(String(loc.lat));
    setLonInput(String(loc.lon));
    setErr(null);
    onChange({ ...config, ...loc });
  };

  const pickPlace = (p: GeoHit) =>
    setLocation({
      label: p.label,
      lat: Number(p.lat.toFixed(4)),
      lon: Number(p.lon.toFixed(4)),
    });

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
        setLocation({
          label: "현재 위치",
          lat: Number(pos.coords.latitude.toFixed(4)),
          lon: Number(pos.coords.longitude.toFixed(4)),
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
    if (!label) return setErr("위치 이름을 입력하세요.");
    if (!Number.isFinite(lat) || lat < -90 || lat > 90)
      return setErr("위도는 -90 ~ 90 사이의 숫자여야 합니다.");
    if (!Number.isFinite(lon) || lon < -180 || lon > 180)
      return setErr("경도는 -180 ~ 180 사이의 숫자여야 합니다.");
    setLocation({ label, lat, lon });
  };

  const isActiveCity = (city: { lat: number; lon: number }) =>
    Math.abs(city.lat - config.lat) < 1e-4 &&
    Math.abs(city.lon - config.lon) < 1e-4;

  return (
    <div className="flex flex-col gap-4">
      {/* 성별 */}
      <fieldset className="flex flex-col gap-2 rounded-md border border-border p-3">
        <legend className="px-1 text-xs font-medium text-muted-foreground">
          성별
        </legend>
        <div className="grid grid-cols-2 gap-1.5">
          {GENDERS.map((g) => (
            <button
              key={g.id}
              type="button"
              aria-pressed={config.gender === g.id}
              onClick={() => onChange({ ...config, gender: g.id })}
              className={chipClass(config.gender === g.id)}
            >
              <span aria-hidden>{g.icon}</span>
              {g.label}
            </button>
          ))}
        </div>
      </fieldset>

      {/* 활동 */}
      <fieldset className="flex flex-col gap-2 rounded-md border border-border p-3">
        <legend className="px-1 text-xs font-medium text-muted-foreground">
          활동 (기본: 산책 = 일반 외출)
        </legend>
        <div className="grid grid-cols-4 gap-1.5">
          {ACTIVITIES.map((a) => (
            <button
              key={a.id}
              type="button"
              aria-pressed={config.activity === a.id}
              onClick={() =>
                onChange({ ...config, activity: a.id as ActivityType })
              }
              className={chipClass(config.activity === a.id)}
            >
              <span aria-hidden>{a.icon}</span>
              <span className="truncate">{a.label}</span>
            </button>
          ))}
        </div>
      </fieldset>

      {/* 체감 보정 */}
      <fieldset className="flex flex-col gap-2 rounded-md border border-border p-3">
        <legend className="px-1 text-xs font-medium text-muted-foreground">
          체감온도 보정 (추위/더위 민감도)
        </legend>
        <div className="grid grid-cols-5 gap-1.5">
          {SENSITIVITY_OPTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={config.sensitivity === s.id}
              onClick={() => onChange({ ...config, sensitivity: s.id })}
              className={[
                chipClass(config.sensitivity === s.id),
                "flex-col gap-0.5 px-1 text-[11px]",
              ].join(" ")}
            >
              <span className="truncate">{s.label}</span>
              <span className="text-[10px] text-muted-foreground">
                {s.offset > 0 ? `+${s.offset}` : s.offset}°
              </span>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          추위를 많이 타면 체감을 더 춥게 보정해 더 따뜻하게 추천합니다.
        </p>
      </fieldset>

      {/* 기본 시간대 */}
      <fieldset className="flex flex-col gap-2 rounded-md border border-border p-3">
        <legend className="px-1 text-xs font-medium text-muted-foreground">
          기본 시간대
        </legend>
        <div className="grid grid-cols-4 gap-1.5">
          <button
            type="button"
            aria-pressed={!config.periodId}
            onClick={() => onChange({ ...config, periodId: undefined })}
            className={chipClass(!config.periodId)}
          >
            현재 시각
          </button>
          {OUTFIT_PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={config.periodId === p.id}
              onClick={() => onChange({ ...config, periodId: p.id })}
              className={chipClass(config.periodId === p.id)}
            >
              <span aria-hidden>{p.emoji}</span>
              <span className="truncate">{p.label}</span>
            </button>
          ))}
        </div>
      </fieldset>

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
            placeholder="예: 역삼동, 스카이72 골프장, 정자동"
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
        {searchErr ? (
          <p className="text-xs text-destructive">{searchErr}</p>
        ) : null}
        {places.length > 0 ? (
          <ul className="flex max-h-52 flex-col gap-1 overflow-y-auto pb-scroll">
            {places.map((p, i) => {
              const active =
                Math.abs(p.lat - config.lat) < 1e-3 &&
                Math.abs(p.lon - config.lon) < 1e-3;
              return (
                <li key={`${p.lat},${p.lon},${i}`}>
                  <button
                    type="button"
                    onClick={() => pickPlace(p)}
                    aria-pressed={active}
                    className={[
                      "flex w-full flex-col items-start gap-0.5 rounded-md border px-2 py-1.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                      active
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
              );
            })}
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
        <div className="grid grid-cols-3 gap-1.5">
          {COMMON_CITIES.map((city) => (
            <button
              key={city.label}
              type="button"
              aria-pressed={isActiveCity(city)}
              onClick={() => setLocation(city)}
              className={chipClass(isActiveCity(city))}
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

export default OutfitConfigEditor;
