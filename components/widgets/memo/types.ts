/**
 * memo widget — config shape (설계서 §2.1 #2: 본문·색상·크기).
 *
 *  Kept JSON-serializable so it round-trips through pb_widgets.config (jsonb).
 *  All views render PURELY from this config (no local seeded state) so editing
 *  config via the ConfigEditor re-renders the tile — the demo memo held its own
 *  state and could not reflect config edits; the real widget fixes that.
 */
export interface MemoConfig {
  /**
   * 메모 제목(선택). 본문 상단 입력란과 위젯 헤더 제목이 이 값을 공유하므로,
   * 어느 쪽에서 바꿔도 다른 쪽에 반영된다. 비면 헤더는 displayName("메모")로 폴백.
   */
  title?: string;
  /** Body text. */
  text: string;
  /** Accent color token key (mapped to a concrete swatch in the views). */
  color: MemoColor;
  /** Font size bucket for the body. */
  size: MemoSize;
  /**
   * Body text color (CSS color). Optional — when unset the body follows the
   * theme foreground (라이트=검정 · 다크=흰색). A concrete color overrides that.
   */
  textColor?: string;
  /**
   * Optional per-memo password as a SHA-256 HASH (never plaintext). When set the
   * memo is SCREEN-LOCKED: the tile hides the body behind an unlock prompt and
   * the editor hides the text field. null/undefined = no lock.
   *
   * ⚠ Screen-lock only — the body itself is stored PLAINTEXT in pb_widgets.config
   *   (RLS, user-only). Suitable for hiding notes from casual view; for true
   *   secrets prefer the 비밀번호 금고(credentials) widget (AES-GCM encrypted).
   */
  pwHash?: string | null;
  /** Minutes after unlocking before the memo auto-relocks (when a password is set). */
  lockAfterMin?: number;
}

export type MemoColor = "default" | "amber" | "rose" | "green" | "blue" | "violet";
export type MemoSize = "sm" | "md" | "lg";

/** Selectable swatches — value is a usable CSS color (border/left-rail accent). */
export const MEMO_COLORS: Record<MemoColor, { label: string; swatch: string }> = {
  default: { label: "기본", swatch: "var(--border)" },
  amber: { label: "앰버", swatch: "oklch(0.78 0.15 80)" },
  rose: { label: "로즈", swatch: "oklch(0.7 0.18 15)" },
  green: { label: "그린", swatch: "oklch(0.72 0.16 150)" },
  blue: { label: "블루", swatch: "oklch(0.68 0.14 240)" },
  violet: { label: "바이올렛", swatch: "oklch(0.68 0.17 295)" },
};

/**
 * Body text-color presets (concrete CSS colors). The "자동(테마)" choice is the
 * absence of a value (textColor undefined) → body uses the theme foreground.
 */
export const MEMO_TEXT_COLORS: string[] = [
  "#ef4444", // red
  "#f59e0b", // amber
  "#10b981", // green
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#6b7280", // gray
  "#111827", // near-black
];

/** Body font-size per bucket (compact view scales up via @container). */
export const MEMO_SIZE_CLASS: Record<MemoSize, string> = {
  sm: "text-xs @[220px]/widget:text-sm",
  md: "text-sm @[220px]/widget:text-base",
  lg: "text-base @[220px]/widget:text-lg",
};

/** Body font-size per bucket for the (larger) expanded view. */
export const MEMO_SIZE_CLASS_EXPANDED: Record<MemoSize, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
};

/**
 * 제목 글자 크기 — 같은 size 버킷의 본문보다 한 단계 큰 값(요구: 기존 글자보다 크게).
 * 본문 클래스와 나란히 두어 어긋나지 않게 한다.
 *
 * 전체보기 전용이다: 타일에서는 프레임 헤더가 제목을 보여주므로 본문에 제목이 없다
 * (titleInBody — 제목이 한 곳에만 보이게 하는 분담).
 */
export const MEMO_TITLE_CLASS_EXPANDED: Record<MemoSize, string> = {
  sm: "text-base",
  md: "text-lg",
  lg: "text-xl",
};

/**
 * 위젯 헤더/전체보기에 표시할 인스턴스 제목. 비면 null → 프레임이 displayName("메모")로
 * 폴백한다. (contract의 instanceTitle 옵션 — 뉴스 위젯과 같은 경로)
 */
export function memoInstanceTitle(config: MemoConfig): string | null {
  return config.title?.trim() || null;
}

export const DEFAULT_MEMO_CONFIG: MemoConfig = {
  text: "",
  color: "default",
  size: "md",
};

/** SHA-256 hex of a password (with a fixed app salt). Empty → null (no lock). */
export async function hashPassword(pw: string): Promise<string | null> {
  const p = pw.trim();
  if (!p) return null;
  const data = new TextEncoder().encode(`pb:memo-pw:${p}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
