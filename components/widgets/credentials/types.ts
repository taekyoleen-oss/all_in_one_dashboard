/**
 * credentials — "비밀번호 금고" : a password-protected store of website logins
 * (사이트명 · 주소 · 아이디 · 비밀번호 · 비고).
 *
 *  ── Security model (중요) ──────────────────────────────────────────────────
 *  PaneBoard's guardrail forbids persisting raw passwords to the server. So this
 *  widget NEVER stores credentials in `pb_widgets.config` (which round-trips to
 *  Supabase). Instead the whole entry list is **encrypted client-side** with
 *  WebCrypto AES-GCM, the key derived from a MASTER password via PBKDF2, and the
 *  ciphertext is kept ONLY in localStorage (device-local — same precedent as the
 *  clipboard widget). Consequences:
 *    • No plaintext password is ever written anywhere.
 *    • A wrong master password fails AES-GCM authentication → cannot decrypt.
 *    • Data lives on this device only; it does not sync across devices.
 *  The widget `config` holds nothing sensitive — only the auto-relock minutes.
 */

/** One stored website login. Lives only inside the encrypted blob. */
export interface Credential {
  id: string;
  /** 사이트명 (e.g. "GitHub"). */
  site: string;
  /** 웹사이트 주소 (URL). */
  url: string;
  /** 아이디 / 사용자명. */
  username: string;
  /** 비밀번호 (encrypted at rest; only decrypted in memory while unlocked). */
  password: string;
  /** 비고 — free-text note describing the site / account. */
  note: string;
}

/** Non-sensitive widget config (safe to persist to Supabase). */
export interface CredentialsConfig {
  /** Minutes of inactivity before the vault auto-relocks. */
  lockAfterMin: number;
}

export const DEFAULT_CREDENTIALS_CONFIG: CredentialsConfig = {
  lockAfterMin: 5,
};

/** The encrypted blob persisted in localStorage. */
export interface VaultBlob {
  /** Format version. */
  v: 1;
  /** PBKDF2 salt (base64). */
  salt: string;
  /** AES-GCM IV (base64). */
  iv: string;
  /** Ciphertext of JSON.stringify(Credential[]) (base64). */
  ct: string;
}

/* --------------------------------- crypto --------------------------------- */

const PBKDF2_ITERATIONS = 150_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

function toBase64(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** Derive an AES-GCM key from the master password + salt (PBKDF2-SHA256). */
async function deriveKey(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** A live unlocked session: the derived key + the salt it was derived from. */
export interface VaultKey {
  key: CryptoKey;
  salt: Uint8Array<ArrayBuffer>;
}

/** Create a fresh key (new random salt) for a master password — used at setup
 *  and when changing the master password. */
export async function createVaultKey(password: string): Promise<VaultKey> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const key = await deriveKey(password, salt);
  return { key, salt };
}

/** Encrypt the entry list into a persistable blob (new random IV each call). */
export async function encryptEntries(
  entries: Credential[],
  vk: VaultKey,
): Promise<VaultBlob> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const plaintext = new TextEncoder().encode(JSON.stringify(entries));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, vk.key, plaintext);
  return { v: 1, salt: toBase64(vk.salt), iv: toBase64(iv), ct: toBase64(ct) };
}

/**
 * Try to unlock a blob with a master password. Returns the decrypted entries +
 * the live key (for subsequent saves), or null when the password is wrong (the
 * AES-GCM authentication tag check fails → decrypt throws).
 */
export async function decryptVault(
  blob: VaultBlob,
  password: string,
): Promise<{ entries: Credential[]; vk: VaultKey } | null> {
  try {
    const salt = fromBase64(blob.salt);
    const key = await deriveKey(password, salt);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(blob.iv) },
      key,
      fromBase64(blob.ct),
    );
    const parsed = JSON.parse(new TextDecoder().decode(plain)) as unknown;
    const entries = Array.isArray(parsed) ? (parsed as Credential[]) : [];
    return { entries, vk: { key, salt } };
  } catch {
    return null; // wrong password or corrupt blob
  }
}

/** Generate a short unique id for a new entry. */
export function newCredentialId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
}
