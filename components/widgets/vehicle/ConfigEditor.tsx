"use client";

/**
 * vehicle · ConfigEditor — manage the vehicle, logs and reminders (차량 관리).
 *
 *  Delegates to VehicleManager. All changes report up via onChange (parent persists).
 */

import * as React from "react";
import type { ConfigEditorProps } from "@/lib/widgets/contract";
import { VehicleManager } from "./VehicleManager";
import type { VehicleConfig } from "./types";

export function VehicleConfigEditor({
  config,
  onChange,
}: ConfigEditorProps<VehicleConfig>) {
  return <VehicleManager config={config} onChange={onChange} />;
}

export default VehicleConfigEditor;
