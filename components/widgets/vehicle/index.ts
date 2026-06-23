/**
 * vehicle — WidgetDefinition (차량 관리). dataMode: 'static' (computed locally from
 * config with date-fns). copyBehavior: 'config' (duplicate the vehicle record).
 */

import { Car } from "lucide-react";
import type { WidgetDefinition } from "@/lib/widgets/contract";
import { VehicleCompactView } from "./CompactView";
import { VehicleExpandedView } from "./ExpandedView";
import { VehicleConfigEditor } from "./ConfigEditor";
import { DEFAULT_VEHICLE_CONFIG, type VehicleConfig } from "./types";

export const vehicleWidget: WidgetDefinition<VehicleConfig> = {
  type: "vehicle",
  displayName: "차량 관리",
  icon: Car,
  category: "extended",
  defaultConfig: DEFAULT_VEHICLE_CONFIG,
  defaultSize: { w: 6, h: 6 },
  minSize: { w: 4, h: 3 },
  maxSize: { w: 12, h: 16 },
  CompactView: VehicleCompactView,
  ExpandedView: VehicleExpandedView,
  ConfigEditor: VehicleConfigEditor,
  copyBehavior: "config",
  dataMode: "static",
};

export default vehicleWidget;
export type { VehicleConfig } from "./types";
