/**
 * contacts widget — config shape (설계서 §2.1 #5: 연락처 목록·검색·tel/mailto).
 *
 *  Contacts live in `config` (JSON-serializable). This is personal-contact data —
 *  sensitive-ish but ALLOWED (not in the D5 forbidden set: 주민번호/카드번호 전체/
 *  비밀번호/계좌 비밀번호). dataMode: 'static'. copyBehavior: 'custom' (copy a
 *  selected contact or a single field).
 */
export interface Contact {
  /** Stable id (list keys + reorder). */
  id: string;
  /** Display name, e.g. "홍길동". */
  name: string;
  /** Phone number (free text; used for tel: + copy). */
  phone: string;
  /** Email (used for mailto: + copy). */
  email: string;
  /** Free-form memo (e.g. relationship, notes). */
  memo: string;
  /** Pinned to the compact "favorites" view. */
  favorite: boolean;
}

export interface ContactsConfig {
  contacts: Contact[];
}

export const DEFAULT_CONTACTS_CONFIG: ContactsConfig = {
  contacts: [
    {
      id: "c1",
      name: "홍길동",
      phone: "010-1234-5678",
      email: "hong@example.com",
      memo: "",
      favorite: true,
    },
  ],
};

/** Sanitize a phone string into a tel: target (keep digits, +, *, #). */
export function telHref(phone: string): string {
  const cleaned = phone.replace(/[^\d+*#]/g, "");
  return cleaned ? `tel:${cleaned}` : "#";
}

/** mailto: target for an email (or "#" when empty). */
export function mailHref(email: string): string {
  const e = email.trim();
  return e ? `mailto:${e}` : "#";
}

/** Case-insensitive match of a contact against a query (name/phone/email/memo). */
export function matchesQuery(c: Contact, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    c.name.toLowerCase().includes(q) ||
    c.phone.toLowerCase().includes(q) ||
    c.email.toLowerCase().includes(q) ||
    c.memo.toLowerCase().includes(q)
  );
}

/** First letter for the avatar (name first, else "?"). */
export function contactInitial(c: Contact): string {
  return (c.name.trim() || "?").charAt(0).toUpperCase();
}
