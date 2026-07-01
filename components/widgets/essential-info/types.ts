/**
 * essential-info → "메모장(비번설정)" — a FREEFORM memo you can lock with a
 * password (설계서 §2.1 #6 재정의). Free text (not structured fields). When a
 * password is set, the content is hidden behind an unlock prompt and AUTO-RELOCKS
 * a fixed time AFTER unlocking (absolute — keeps counting even while editing) and
 * on every reload. dataMode:'static'. copyBehavior:'custom'.
 *
 *  Security note: the password is stored only as a SHA-256 HASH (never plaintext)
 *  and gates the UI; the note body itself is plaintext jsonb under RLS (user-only),
 *  same as the previous essential-info. Do not store truly forbidden secrets
 *  (주민번호·카드번호 전체·계좌 비밀번호) here.
 */

/** Legacy structured row (pre-rewrite) — used only to migrate old configs. */
export interface InfoItem {
  id: string;
  label: string;
  value: string;
  masked?: boolean;
}

export interface EssentialInfoConfig {
  /** Free note body. */
  text: string;
  /** SHA-256 hash of the unlock password; null = no lock. */
  pwHash: string | null;
  /** Minutes after unlocking before the note auto-relocks (absolute; when a
   *  password is set). */
  lockAfterMin: number;
  /** Legacy field — old structured rows, migrated to `text` on first read. */
  items?: InfoItem[];
}

export const DEFAULT_ESSENTIAL_INFO_CONFIG: EssentialInfoConfig = {
  text: "",
  pwHash: null,
  lockAfterMin: 5,
};

/** Body text for any config, migrating legacy `items` → "라벨: 값" lines once. */
export function effectiveText(config: EssentialInfoConfig): string {
  if (typeof config.text === "string" && config.text.length > 0) return config.text;
  if (Array.isArray(config.items) && config.items.length > 0) {
    return config.items
      .filter((i) => i.label || i.value)
      .map((i) => (i.label ? `${i.label}: ${i.value}` : i.value))
      .join("\n");
  }
  return typeof config.text === "string" ? config.text : "";
}

/** SHA-256 hex of a password (with a fixed app salt). Empty → null (no lock). */
export async function hashPassword(pw: string): Promise<string | null> {
  const p = pw.trim();
  if (!p) return null;
  const data = new TextEncoder().encode(`pb:memo-lock:${p}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
