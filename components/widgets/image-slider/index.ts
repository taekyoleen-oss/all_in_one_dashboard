/**
 * image-slider — WidgetDefinition (설계서 §2.1 #4). dataMode: 'static'.
 * copyBehavior: 'config' (duplicate the slide list). Storage upload is DEFERRED —
 * slides reference image URLs (or session-only object-URL previews) for now.
 *
 * // TODO(storage): upload to pb-images bucket {user_id}/{instance_id}/{file},
 * // store signed-URL refs.
 */

import { Images } from "lucide-react";
import type { WidgetDefinition } from "@/lib/widgets/contract";
import { ImageSliderCompactView } from "./CompactView";
import { ImageSliderExpandedView } from "./ExpandedView";
import { ImageSliderConfigEditor } from "./ConfigEditor";
import {
  DEFAULT_IMAGE_SLIDER_CONFIG,
  type ImageSliderConfig,
} from "./types";

export const imageSliderWidget: WidgetDefinition<ImageSliderConfig> = {
  type: "image-slider",
  displayName: "이미지 슬라이드",
  icon: Images,
  category: "core",
  defaultConfig: DEFAULT_IMAGE_SLIDER_CONFIG,
  defaultSize: { w: 6, h: 6 },
  minSize: { w: 4, h: 2 },
  maxSize: { w: 16, h: 12 },
  CompactView: ImageSliderCompactView,
  ExpandedView: ImageSliderExpandedView,
  ConfigEditor: ImageSliderConfigEditor,
  copyBehavior: "config",
  dataMode: "static",
};

export default imageSliderWidget;
export type { ImageSliderConfig } from "./types";
