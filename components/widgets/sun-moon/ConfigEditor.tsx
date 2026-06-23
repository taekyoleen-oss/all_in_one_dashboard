"use client";

/**
 * sun-moon · ConfigEditor — set the location (일출·일몰/달 위상).
 *
 *  Reuses the shared LocationPicker. Sun/moon are computed from this location +
 *  the device clock. Reports the whole next config via onChange (parent persists).
 */

import * as React from "react";
import type { ConfigEditorProps } from "@/lib/widgets/contract";
import { LocationPicker } from "@/components/widgets/shared/LocationPicker";
import type { SunMoonConfig } from "./types";

export function SunMoonConfigEditor({
  config,
  onChange,
}: ConfigEditorProps<SunMoonConfig>) {
  return (
    <LocationPicker
      value={{ label: config.label, lat: config.lat, lon: config.lon }}
      onPick={(loc) => onChange({ label: loc.label, lat: loc.lat, lon: loc.lon })}
    />
  );
}

export default SunMoonConfigEditor;
