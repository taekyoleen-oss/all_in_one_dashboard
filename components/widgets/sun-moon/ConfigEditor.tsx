"use client";

/**
 * sun-moon · ConfigEditor — set the location (일출·일몰/달 위상).
 *
 *  Reuses the shared LocationPicker. Sun/moon are computed from this location +
 *  the device clock. Reports the whole next config via onChange (parent persists).
 */

import * as React from "react";
import type { ConfigEditorProps } from "@/lib/widgets/contract";
import {
  LocationPicker,
  LOCATION_CITIES,
  WORLD_CITIES,
} from "@/components/widgets/shared/LocationPicker";
import type { SunMoonConfig } from "./types";

/** 일출/일몰·달은 전 지구적 정보라 국내 + 세계 주요 도시를 함께 제공한다. */
const SUN_MOON_CITIES = [...LOCATION_CITIES, ...WORLD_CITIES];

export function SunMoonConfigEditor({
  config,
  onChange,
}: ConfigEditorProps<SunMoonConfig>) {
  return (
    <LocationPicker
      value={{ label: config.label, lat: config.lat, lon: config.lon }}
      onPick={(loc) => onChange({ label: loc.label, lat: loc.lat, lon: loc.lon })}
      cities={SUN_MOON_CITIES}
    />
  );
}

export default SunMoonConfigEditor;
