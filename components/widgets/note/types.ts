/**
 * note widget — config shape (노트: 리치 텍스트 + 이미지 + 표 + 파일 첨부).
 *
 *  A multi-purpose note for recording lecture content: formatted text (굵게/기울임/
 *  밑줄/색/형광펜/글자크기/제목/글머리·번호목록/정렬), inline images, tables, and file
 *  attachments. Everything lives in config (jsonb) — body HTML is sanitized, images
 *  are downscaled to data URLs, and attachments are stored inline (base64, capped),
 *  so a note round-trips through pb_widgets.config and survives reload + sync. No
 *  external API. dataMode: 'static'.
 */

/** A file attached to the note (stored inline as a data URL). */
export interface NoteAttachment {
  /** Stable id (list keys). */
  id: string;
  /** Original file name (for display + download). */
  name: string;
  /** MIME type (for the icon + download). */
  type: string;
  /** Original byte size. */
  size: number;
  /** Self-contained data URL (base64). */
  dataUrl: string;
}

export interface NoteConfig {
  /** Note title (shown on the tile header area). */
  title: string;
  /** Sanitized rich-text body as HTML. */
  html: string;
  /** Inline file attachments. */
  attachments: NoteAttachment[];
  /** Last edit time (epoch ms), for a "수정: …" line. Optional. */
  updatedAt?: number;
}

export const DEFAULT_NOTE_CONFIG: NoteConfig = {
  title: "",
  html: "",
  attachments: [],
};

/** Per-attachment size cap (~5MB) — keeps the jsonb config save healthy. */
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

/** Font-size presets offered in the toolbar (px). */
export const FONT_SIZES: Array<{ label: string; px: number }> = [
  { label: "작게", px: 13 },
  { label: "보통", px: 16 },
  { label: "크게", px: 20 },
  { label: "아주 크게", px: 26 },
];

/** Text + highlight color swatches (concrete CSS colors). */
export const TEXT_COLORS: string[] = [
  "#111827", // near-black
  "#ef4444", // red
  "#f59e0b", // amber
  "#10b981", // green
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#6b7280", // gray
];

export const HIGHLIGHT_COLORS: string[] = [
  "#fef08a", // yellow
  "#bbf7d0", // green
  "#bfdbfe", // blue
  "#fbcfe8", // pink
  "#fed7aa", // orange
  "#e9d5ff", // purple
  "transparent", // 형광펜 제거
];
