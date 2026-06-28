"use client";

/**
 * weather · ConfigEditor — set the location (설계서 §2.1).
 *
 *  Controlled: reports the whole next config via onChange (the dialog owns the
 *  draft; the parent owns persistence). Three ways to set a location:
 *    1. 현재 위치 — navigator.geolocation → lat/lon (label "현재 위치").
 *    2. 도시 선택 — pick from a small curated catalog.
 *    3. 직접 입력 — type a label + lat/lon.
 *  No weather DATA is stored — only the location (live conditions arrive from
 *  /api/weather). Geolocation is gated behind an explicit button (no silent
 *  prompt) and degrades gracefully when denied/unavailable.
 */

import * as React from "react";
import { LocateFixed, MapPin, Search } from "lucide-react";
import type { ConfigEditorProps } from "@/lib/widgets/contract";
import {
  COMMON_CITIES,
  type WeatherConfig,
  type WeatherView,
  type WeatherLayout,
} from "./types";

const VIEW_OPTIONS: Array<{ value: WeatherView; label: string }> = [
  { value: "current", label: "현재" },
  { value: "hourly", label: "시간별" },
  { value: "daily", label: "주간" },
];

const LAYOUT_OPTIONS: Array<{ value: WeatherLayout; label: string }> = [
  { value: "horizontal", label: "가로" },
  { value: "vertical", label: "세로" },
];

/** One geocode hit from /api/geocode (kept local so no server module is bundled). */
interface GeoHit {
  label: string;
  detail: string;
  lat: number;
  lon: number;
}

export function WeatherConfigEditor({
  config,
  onChange,
}: ConfigEditorProps<WeatherConfig>) {
  const [labelInput, setLabelInput] = React.useState(config.label);
  const [latInput, setLatInput] = React.useState(String(config.lat));
  const [lonInput, setLonInput] = React.useState(String(config.lon));
  const [geoState, setGeoState] = React.useState<
    "idle" | "locating" | "error"
  >("idle");
  const [err, setErr] = React.useState<string | null>(null);

  // 주소·장소 검색 상태 (동 단위 주소·골프장 등 → 좌표).
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

  const pickPlace = (p: GeoHit) => {
    const lat = Number(p.lat.toFixed(4));
    const lon = Number(p.lon.toFixed(4));
    setLabelInput(p.label);
    setLatInput(String(lat));
    setLonInput(String(lon));
    setErr(null);
    onChange({ ...config, label: p.label, lat, lon });
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
        const lat = Number(pos.coords.latitude.toFixed(4));
        const lon = Number(pos.coords.longitude.toFixed(4));
        const next: WeatherConfig = {
          ...config,
          label: "현재 위치",
          lat,
          lon,
        };
        setLabelInput(next.label);
        setLatInput(String(next.lat));
        setLonInput(String(next.lon));
        setGeoState("idle");
        onChange(next);
        // Resolve the actual 동(neighborhood) name in the background so the label
        // reflects where you are (not just "현재 위치"). Best-effort: keep the
        // generic label if the reverse lookup fails.
        void (async () => {
          try {
            const res = await fetch(`/api/geocode?lat=${lat}&lon=${lon}`);
            const json = (await res.json()) as {
              result?: { label?: string } | null;
            };
            const dong = json.result?.label?.trim();
            if (dong) {
              setLabelInput(dong);
              onChange({ ...config, label: dong, lat, lon });
            }
          } catch {
            /* keep "현재 위치" */
          }
        })();
      },
      () => {
        setGeoState("error");
        setErr("위치 권한이 거부되었거나 위치를 가져오지 못했습니다.");
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 },
    );
  };

  const pickCity = (city: { label: string; lat: number; lon: number }) => {
    setLabelInput(city.label);
    setLatInput(String(city.lat));
    setLonInput(String(city.lon));
    setErr(null);
    onChange({ ...config, ...city });
    // 동까지 세분화: 도시 좌표를 역지오코딩해 라벨을 행정동으로 보강(요구: 실제 동까지).
    // best-effort — 실패 시 도시 라벨 유지.
    void (async () => {
      try {
        const res = await fetch(`/api/geocode?lat=${city.lat}&lon=${city.lon}`);
        const json = (await res.json()) as {
          result?: { label?: string } | null;
        };
        const dong = json.result?.label?.trim();
        if (dong) {
          setLabelInput(dong);
          onChange({ ...config, label: dong, lat: city.lat, lon: city.lon });
        }
      } catch {
        /* keep the city label */
      }
    })();
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
    onChange({ ...config, label, lat, lon });
  };

  const isActiveCity = (city: { lat: number; lon: number }) =>
    Math.abs(city.lat - config.lat) < 1e-4 &&
    Math.abs(city.lon - config.lon) < 1e-4;

  const view = config.view ?? "current";

  return (
    <div className="flex flex-col gap-4">
      {/* Tile view selector — 현재 / 시간별 / 주간 */}
      <fieldset className="flex flex-col gap-2 rounded-md border border-border p-3">
        <legend className="px-1 text-xs font-medium text-muted-foreground">
          표시 내용 (타일)
        </legend>
        <div className="grid grid-cols-3 gap-1.5">
          {VIEW_OPTIONS.map((opt) => {
            const active = view === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ ...config, view: opt.value })}
                className={[
                  "rounded-md border px-2 py-1.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-foreground hover:bg-accent/40",
                ].join(" ")}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground">
          타일에 보여줄 내용을 선택하세요. ‘자세히’에서는 현재·시간별·주간을 모두 봅니다.
        </p>
      </fieldset>

      {/* 시간별·주간 표시 방향 — 가로 줄 / 세로 목록 (타일·자세히 공통) */}
      <fieldset className="flex flex-col gap-3 rounded-md border border-border p-3">
        <legend className="px-1 text-xs font-medium text-muted-foreground">
          시간별·주간 방향
        </legend>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">시간별</span>
          <div className="grid grid-cols-2 gap-1.5">
            {LAYOUT_OPTIONS.map((opt) => {
              const active = (config.hourlyLayout ?? "horizontal") === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    onChange({ ...config, hourlyLayout: opt.value })
                  }
                  className={[
                    "rounded-md border px-2 py-1.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-foreground hover:bg-accent/40",
                  ].join(" ")}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">주간</span>
          <div className="grid grid-cols-2 gap-1.5">
            {LAYOUT_OPTIONS.map((opt) => {
              const active = (config.dailyLayout ?? "horizontal") === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange({ ...config, dailyLayout: opt.value })}
                  className={[
                    "rounded-md border px-2 py-1.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-foreground hover:bg-accent/40",
                  ].join(" ")}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          시간별·주간 목록을 가로 줄 또는 세로 목록으로 표시합니다.
        </p>
      </fieldset>

      {/* Place / address search — 동 단위 주소·골프장 등 */}
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
            placeholder="예: 역삼동, 스카이72 골프장, 분당구 정자동"
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
        <p className="text-[11px] text-muted-foreground">
          동 단위 주소나 골프장·건물 이름으로 검색해 정확한 위치를 지정할 수 있어요.
        </p>
      </fieldset>

      {/* Current location */}
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
        <p className="text-[11px] text-muted-foreground">
          기기의 위치 권한을 한 번 요청합니다(거부해도 다른 방법으로 설정 가능).
        </p>
      </fieldset>

      {/* City picker */}
      <fieldset className="flex flex-col gap-2 rounded-md border border-border p-3">
        <legend className="px-1 text-xs font-medium text-muted-foreground">
          지역 선택
        </legend>
        <div className="grid grid-cols-3 gap-1.5">
          {COMMON_CITIES.map((city) => {
            const active = isActiveCity(city);
            return (
              <button
                key={city.label}
                type="button"
                aria-pressed={active}
                onClick={() => pickCity(city)}
                className={[
                  "inline-flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-foreground hover:bg-accent/40",
                ].join(" ")}
              >
                <MapPin size={14} aria-hidden className="shrink-0" />
                <span className="truncate">{city.label}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Manual entry */}
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

export default WeatherConfigEditor;
