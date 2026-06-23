"use client";

/**
 * air-quality · ConfigEditor — set the location (대기질).
 *
 *  Reuses the shared LocationPicker (search / 현재 위치 / 지역 / 직접 입력). Only the
 *  location is stored; live readings arrive from /api/air-quality. Reports the
 *  whole next config via onChange (parent owns persistence).
 */

import * as React from "react";
import type { ConfigEditorProps } from "@/lib/widgets/contract";
import { LocationPicker } from "@/components/widgets/shared/LocationPicker";
import type { AirQualityConfig } from "./types";

export function AirQualityConfigEditor({
  config,
  onChange,
}: ConfigEditorProps<AirQualityConfig>) {
  return (
    <LocationPicker
      value={{ label: config.label, lat: config.lat, lon: config.lon }}
      onPick={(loc) => onChange({ label: loc.label, lat: loc.lat, lon: loc.lon })}
    />
  );
}

export default AirQualityConfigEditor;
