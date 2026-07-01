/**
 * memo widget — config shape (설계서 §2.1 #2: 본문·색상·크기).
 *
 *  Kept JSON-serializable so it round-trips through pb_widgets.config (jsonb).
 *  All views render PURELY from this config (no local seeded state) so editing
 *  config via the ConfigEditor re-renders the tile — the demo memo held its own
 *  state and could not reflect config edits; the real widget fixes that.
 */
export interface MemoConfig {
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
