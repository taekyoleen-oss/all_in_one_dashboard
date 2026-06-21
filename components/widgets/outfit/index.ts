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
  // 캔버스에 추가 시 모든 내용(시간대·체감·일러스트·추천 아이템)이 보이도록 세로를
  // 넉넉히. 격자 2배 해상도 기준 h:16 ≈ 858px 높이.
  defaultSize: { w: 8, h: 16 },
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
