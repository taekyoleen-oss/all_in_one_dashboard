/**
 * ============================================================================
 *  KIS secret cache — PERSISTENT (file-backed) so tokens survive restarts
 * ============================================================================
 *
 *  SERVER-ONLY (Node runtime). KIS issues 24-hour access tokens AND sends a
 *  KakaoTalk push on EVERY new access-token issuance. An in-process-only cache is
 *  emptied on every restart (redeploy · serverless cold start · `next dev`
 *  reload · a second instance), so each restart re-issues a token and triggers
 *  another KakaoTalk message. To match KIS's "발급은 하루 한 번" guidance, we
 *  persist the issued value to disk and reuse it for its full validity across
 *  restarts (the same idea as the official token_cache.json sample).
 *
 *  Layering: an in-memory map (fast, per-process) over a single JSON file
 *  (survives restarts). Values are namespaced by `key` so one file holds both the
 *  access token and the realtime approval key.
 *
 *  File location: $KIS_TOKEN_CACHE_FILE if set, else <os.tmpdir()>/
 *  paneboard-kis-token-cache.json. We write directly (no temp+rename) so it works
 *  on Windows too; every read/write is wrapped so a missing/corrupt file just
 *  means "re-issue once" — this module NEVER throws.
 *
 *  Security: the file stores the short-/medium-lived TOKEN + APPROVAL KEY only —
 *  never the appkey/appsecret. Keep it on a private server filesystem and do not
 *  commit it (the default temp-dir path is outside the repo; `.env*` and the repo
 *  are unaffected).
 * ============================================================================
 */

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

/** One cached secret + the epoch-ms instant after which it must be re-issued. */
interface CacheEntry {
  token: string;
  expiresAt: number;
}
type CacheFile = Record<string, CacheEntry>;

/** Resolve the cache-file path once (env override → OS temp dir default). */
const CACHE_FILE =
  process.env.KIS_TOKEN_CACHE_FILE?.trim() ||
  path.join(os.tmpdir(), "paneboard-kis-token-cache.json");

/** Fast per-process mirror so warm requests never touch the disk. */
const memory = new Map<string, CacheEntry>();

/** Read+parse the whole cache file; {} on any error (missing/corrupt/locked). */
async function readFile(): Promise<CacheFile> {
  try {
    const raw = await fs.readFile(CACHE_FILE, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as CacheFile) : {};
  } catch {
    return {};
  }
}

/** Overwrite the cache file; best-effort (the in-memory mirror still serves us). */
async function writeFile(data: CacheFile): Promise<void> {
  try {
    // Direct write (no temp+rename) — cross-platform incl. Windows. mode 0o600
    // restricts to the owner where the FS honors it (no-op on Windows).
    await fs.writeFile(CACHE_FILE, JSON.stringify(data), { mode: 0o600 });
  } catch {
    /* best-effort: a failed write just means the next restart re-issues once */
  }
}

/**
 * Return a still-valid cached secret for `key` (memory → file), or null when
 * absent/expired. A live file hit is promoted into memory for subsequent reads.
 */
export async function readCachedSecret(key: string): Promise<string | null> {
  const now = Date.now();

  const mem = memory.get(key);
  if (mem && now < mem.expiresAt) return mem.token;

  const file = await readFile();
  const entry = file[key];
  if (entry && typeof entry.token === "string" && now < entry.expiresAt) {
    memory.set(key, entry); // promote to the fast path
    return entry.token;
  }
  return null;
}

/**
 * Persist `token` for `key` until `expiresAt` (epoch ms), updating both the
 * in-memory mirror and the file so a restart reuses it.
 */
export async function writeCachedSecret(
  key: string,
  token: string,
  expiresAt: number,
): Promise<void> {
  const entry: CacheEntry = { token, expiresAt };
  memory.set(key, entry);
  const file = await readFile();
  file[key] = entry;
  await writeFile(file);
}

/**
 * Forget a cached secret (memory + file). Used to self-heal a stale value — e.g.
 * an approval key that the realtime socket rejected — so the next call re-issues.
 */
export async function invalidateCachedSecret(key: string): Promise<void> {
  memory.delete(key);
  const file = await readFile();
  if (file[key]) {
    delete file[key];
    await writeFile(file);
  }
}

/** Namespaced cache keys (one file holds both). */
export const CACHE_KEY = {
  accessToken: "access_token",
  approvalKey: "approval_key",
} as const;
