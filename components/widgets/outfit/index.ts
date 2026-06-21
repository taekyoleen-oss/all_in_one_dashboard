/**
 * outfit — 외출옷 추천 WidgetDefinition.
 *
 *  위치·시간대 기준 체감온도로 옷차림을 추천하고, 원본 Weather_Outfit_Suggestion 앱과
 *  동일한 캐릭터 일러스트를 보여준다. 날씨는 /api/weather에서 폴링(dataMode:'poll').
 *  copyBehavior:'config'(위치·설정 복제).
 */

import { Shirt } from "lucide-react";
import type { WidgetDefinition } from "@/lib/widgets/contract";
import { OutfitCompactView } from "./CompactView";
import { OutfitExpandedView } from "./ExpandedView";
import { OutfitConfigEditor } from "./ConfigEditor";
import { OUTFIT_REFRESH_MS } from "./useOutfit";
import { DEFAULT_OUTFIT_CONFIG, type OutfitConfig } from "./types";

export const outfitWidget: WidgetDefinition<OutfitConfig> = {
  type: "outfit",
  displayName: "외출옷 추천",
  icon: Shirt,
  category: "extended",
  defaultConfig: DEFAULT_OUTFIT_CONFIG,
  defaultSize: { w: 8, h: 10 },
  minSize: { w: 4, h: 6 },
  maxSize: { w: 16, h: 24 },
  CompactView: OutfitCompactView,
  ExpandedView: OutfitExpandedView,
  ConfigEditor: OutfitConfigEditor,
  copyBehavior: "config",
  dataMode: "poll",
  refreshInterval: OUTFIT_REFRESH_MS,
};

export default outfitWidget;
export type { OutfitConfig } from "./types";
