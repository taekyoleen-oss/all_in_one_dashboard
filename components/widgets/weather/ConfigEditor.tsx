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
import { LocateFixed, MapPin } from "lucide-react";
import type { ConfigEditorProps } from "@/lib/widgets/contract";
import { COMMON_CITIES, type WeatherConfig } from "./types";

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
        const next: WeatherConfig = {
          label: "현재 위치",
          lat: Number(pos.coords.latitude.toFixed(4)),
          lon: Number(pos.coords.longitude.toFixed(4)),
        };
        setLabelInput(next.label);
        setLatInput(String(next.lat));
        setLonInput(String(next.lon));
        setGeoState("idle");
        onChange(next);
      },
      () => {
        setGeoState("error");
        setErr("위치 권한이 거부되었거나 위치를 가져오지 못했습니다.");
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 },
    );
  };

  const pickCity = (city: WeatherConfig) => {
    setLabelInput(city.label);
    setLatInput(String(city.lat));
    setLonInput(String(city.lon));
    setErr(null);
    onChange(city);
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
    onChange({ label, lat, lon });
  };

  const isActiveCity = (city: WeatherConfig) =>
    Math.abs(city.lat - config.lat) < 1e-4 &&
    Math.abs(city.lon - config.lon) < 1e-4;

  return (
    <div className="flex flex-col gap-4">
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
          도시 선택
        </legend>
        <div className="grid grid-cols-2 gap-1.5">
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
