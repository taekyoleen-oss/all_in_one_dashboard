/**
 * image-slider widget — config shape (설계서 §2.1 #4: 이미지 슬라이드쇼).
 *
 *  Slides reference images by URL for now. Storage upload is DEFERRED.
 *  // TODO(storage): upload to pb-images bucket {user_id}/{instance_id}/{file},
 *  // store signed-URL refs (replace the raw `url` with a storage path + signed
 *  // URL once auth/Storage wiring lands). For now accept image URLs (or a local
 *  // URL.createObjectURL preview) stored in config.
 *
 *  dataMode: 'static'. copyBehavior: 'config'.
 */
export interface SlideImage {
  /** Stable id (list keys + reorder). */
  id: string;
  /** Image URL (https) or an object-URL preview. */
  url: string;
  /** Optional alt/caption text. */
  caption?: string;
}

export interface ImageSliderConfig {
  images: SlideImage[];
  /** Auto-advance interval in seconds (0 ⇒ no auto-advance). */
  intervalSec: number;
}

export const DEFAULT_IMAGE_SLIDER_CONFIG: ImageSliderConfig = {
  images: [],
  intervalSec: 5,
};

/** Clamp an interval to a sane range; 0 means "off". */
export function clampInterval(sec: number): number {
  if (!Number.isFinite(sec) || sec <= 0) return 0;
  return Math.min(Math.max(Math.round(sec), 2), 60);
}
