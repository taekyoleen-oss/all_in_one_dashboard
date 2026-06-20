"use client";

/**
 * image-slider · ConfigEditor — manage images + interval (설계서 §2.1 #4).
 *
 *  Delegates to ImageManager (add by URL / local file, remove, reorder, caption,
 *  interval). All changes report up via onChange (parent owns persistence).
 *
 *  // TODO(storage): upload to pb-images bucket {user_id}/{instance_id}/{file},
 *  // store signed-URL refs (replaces object-URL/raw-URL config once auth/Storage
 *  // wiring lands).
 */

import * as React from "react";
import type { ConfigEditorProps } from "@/lib/widgets/contract";
import { ImageManager } from "./ImageManager";
import type { ImageSliderConfig } from "./types";

export function ImageSliderConfigEditor({
  config,
  onChange,
}: ConfigEditorProps<ImageSliderConfig>) {
  return (
    <div className="flex flex-col gap-2">
      <ImageManager config={config} onChange={onChange} />
    </div>
  );
}

export default ImageSliderConfigEditor;
