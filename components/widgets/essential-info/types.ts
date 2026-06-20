/**
 * essential-info widget — config shape (설계서 §2.1 #6, §5.2/§5.3 D5 정책).
 *
 *  Label+value rows with optional per-row masking. Marked `sensitive` at the
 *  WidgetDefinition level. Per the D5 policy, TRULY sensitive secrets (주민번호,
 *  카드번호 전체, 비밀번호, 계좌 비밀번호) MUST NOT be stored here — only
 *  medium-grade info (법인등록번호, 주소 등). The ConfigEditor surfaces a
 *  prominent warning; input is not blocked. dataMode: 'static'.
 *  copyBehavior: 'custom' (copy a single field value).
 */
export interface InfoItem {
  /** Stable id (list keys + reorder). */
  id: string;
  /** Field label, e.g. "법인등록번호". */
  label: string;
  /** Field value (plaintext, RLS-protected once persisted). */
  value: string;
  /** When true, hidden behind a mask until the user reveals it. */
  masked: boolean;
}

export interface EssentialInfoConfig {
  items: InfoItem[];
}

export const DEFAULT_ESSENTIAL_INFO_CONFIG: EssentialInfoConfig = {
  items: [
    { id: "e1", label: "주소", value: "", masked: false },
    { id: "e2", label: "법인등록번호", value: "", masked: true },
  ],
};

/** A bullet-dot mask sized to the value (never reveals length precisely). */
export function maskOf(value: string): string {
  const n = Math.min(Math.max(value.length, 4), 12);
  return "•".repeat(n);
}
