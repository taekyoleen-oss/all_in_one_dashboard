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

/**
 * 노트 안의 소제목 섹션 — 같은 분류의 기록(예: 강의 회차·일기 날짜)을 한 노트에
 * 묶는 단위. 타일에는 소제목이 리스트로 보이고, 클릭하면 전체보기가 그 섹션만
 * 단독으로 연다.
 */
export interface NoteSection {
  /** Stable id (list keys + 단일 섹션 포커스 대상 지정). */
  id: string;
  /** 소제목 (타일 리스트·전체보기 섹션 헤더에 표시). */
  title: string;
  /** Sanitized rich-text body as HTML (본문과 동일 살균 규칙). */
  html: string;
  /** Last edit time (epoch ms). Optional. */
  updatedAt?: number;
}

export interface NoteConfig {
  /** Note title (shown on the tile header area). */
  title: string;
  /** Sanitized rich-text body as HTML. */
  html: string;
  /**
   * 소제목 섹션 목록(선택). 비어 있거나 없으면 기존 단일 본문 노트 그대로다
   * (무마이그레이션). 있으면 타일은 본문 미리보기 아래(머리말이 있을 때) 소제목
   * 리스트를 보여주고, 전체보기는 머리말(html) + 섹션 스택을 렌더한다.
   */
  sections?: NoteSection[];
  /** Inline file attachments. */
  attachments: NoteAttachment[];
  /** Last edit time (epoch ms), for a "수정: …" line. Optional. */
  updatedAt?: number;
  /**
   * "공유 받기": when true, this note is the single destination that mobile
   * Web-Share-Target content (/share) appends to. Exactly one note carries this
   * across all boards — enabling it on one note clears it on every other (see
   * usePersistence.setShareTargetNote). The first note created defaults to true.
   */
  shareTarget?: boolean;
  /**
   * 타일 표시/접기 상태(노트 본문 상단 컨트롤). 저장 키는 하위호환으로 'more' 유지.
   *  - 'normal' (기본·생략 시) → '펼침': 머리말+소제목+내용 전부 세로 리스트.
   *               높이는 사용자가 드래그로 정한 그대로(자동 변경 없음).
   *  - 'more'   → '소제목': 소제목 목차만 표시(머리말·내용 숨김). 높이 자동 변경
   *               없음 — 크기는 사용자가 정한다(요구).
   *  - 'title'  → '제목만': 제목 한 줄만(최소 높이). 긴 노트가 공간을 차지하지
   *               않게 하고, 헤더 '전체'로 내용을 연다.
   * 'title' 진입/이탈 시에만 그리드 h가 바뀌어 이웃 위젯이 따라 이동한다. 토글은
   * usePersistence.collapseNote가 layout·config를 함께 갱신한다.
   */
  collapse?: "normal" | "more" | "title";
  /**
   * 접기 직전의 그리드 높이(행 수). '제목만'에서 펼침/소제목으로 복원할 때 이
   * 값으로 h를 되돌린다. 접기 진입 시점의 현재 h를 캡처한다.
   */
  normalHeight?: number;
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

/**
 * "자동" text color — follows the theme foreground token, so body text is dark
 * (≈검정) in light mode and light (≈흰색) in dark mode. Applied as an inline
 * `color: var(--foreground)`; the sanitizer keeps it (no url/expression payload).
 */
export const AUTO_TEXT_COLOR = "var(--foreground)";

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
