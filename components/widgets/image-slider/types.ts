/**
 * image-slider widget — config shape (설계서 §2.1 #4: 이미지 슬라이드쇼).
 *
 *  A slide's `url` is either an https image URL OR a self-contained data URL
 *  (picked/dropped/pasted files are downscaled on a canvas and stored inline by
 *  ImageManager), so slides round-trip through `config` (jsonb) and survive
 *  reload + sync. (A future optimization could move large libraries to the
 *  pb-images Storage bucket with signed URLs.)
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
