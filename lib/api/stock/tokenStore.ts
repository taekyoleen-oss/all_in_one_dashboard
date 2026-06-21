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
 *  Layering: in-memory (fast, per-process) → Supabase Storage (DURABLE + SHARED
 *  across every instance/device/restart — the authoritative layer) → local JSON
 *  file (offline fallback). Values are namespaced by `key` (access token +
 *  realtime approval key). Because the Supabase layer is shared, the token is
 *  issued ONCE per ~24h globally even with many processes — killing the repeated
 *  KakaoTalk pushes regardless of deploy shape.
 *
 *  File location: $KIS_TOKEN_CACHE_FILE if set, else <project>/.cache/
 *  kis-token-cache.json (a STABLE, repo-local path that survives restarts — more
 *  reliable than the OS temp dir, which cleaners may wipe). We write directly (no
 *  temp+rename) so it works on Windows too. Read/write failures degrade to
 *  "re-issue once" — this module NEVER throws — but unlike before they are now
 *  LOGGED (console.error), because a SILENT write failure looks exactly like the
 *  "token re-issued every time" bug we are trying to kill.
 *
 *  Security: the file stores the short-/medium-lived TOKEN + APPROVAL KEY only —
 *  never the appkey/appsecret. The `.cache/` dir is gitignored so it is never
 *  committed; `.env*` and the repo are unaffected.
 * ============================================================================
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { createAdminClient } from "@/lib/supabase/admin";

/** One cached secret + the epoch-ms instant after which it must be re-issued. */
interface CacheEntry {
  token: string;
  expiresAt: number;
}
type CacheFile = Record<string, CacheEntry>;

/* ------------------------- Supabase Storage layer ------------------------- */
// Durable, SHARED cache: survives restarts/redeploys AND is the same across every
// process/instance/device — so the token is issued ONCE per ~24h globally, not
// once per server. Stored as a tiny JSON object in a private bucket (no DB
// migration needed). Falls back silently to the file/memory cache when Supabase
// is unreachable or unconfigured.
const SB_BUCKET = "pb-cache";
const SB_OBJECT = "kis-token-cache.json";
let sbBucketEnsured = false;

function adminClient() {
  try {
    return createAdminClient();
  } catch {
    return null; // env missing → skip the Supabase layer
  }
}

async function readSupabase(): Promise<CacheFile | null> {
  const sb = adminClient();
  if (!sb) return null;
  try {
    const { data, error } = await sb.storage.from(SB_BUCKET).download(SB_OBJECT);
    if (error || !data) return null;
    const text = await data.text();
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as CacheFile) : {};
  } catch {
    return null;
  }
}

async function writeSupabase(data: CacheFile): Promise<boolean> {
  const sb = adminClient();
  if (!sb) return false;
  try {
    if (!sbBucketEnsured) {
      // Create the private bucket once; ignore "already exists".
      await sb.storage.createBucket(SB_BUCKET, { public: false }).catch(() => {});
      sbBucketEnsured = true;
    }
    const body = Buffer.from(JSON.stringify(data), "utf8");
    const { error } = await sb.storage
      .from(SB_BUCKET)
      .upload(SB_OBJECT, body, {
        upsert: true,
        contentType: "application/json",
      });
    return !error;
  } catch {
    return false;
  }
}

/** Resolve the cache-file path once (env override → repo-local .cache default). */
export const KIS_CACHE_FILE =
  process.env.KIS_TOKEN_CACHE_FILE?.trim() ||
  path.join(process.cwd(), ".cache", "kis-token-cache.json");

/** Fast per-process mirror so warm requests never touch the disk. */
const memory = new Map<string, CacheEntry>();

/** Read+parse the whole cache file; {} on any error (missing/corrupt/locked). */
async function readFile(): Promise<CacheFile> {
  try {
    const raw = await fs.readFile(KIS_CACHE_FILE, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as CacheFile) : {};
  } catch {
    return {};
  }
}

/**
 * Overwrite the cache file. Best-effort for control flow (we never throw), BUT a
 * failure is LOGGED — a silent write failure is indistinguishable from the bug
 * where every request re-issues a token (and re-pushes a KakaoTalk). Ensures the
 * parent dir exists first so a fresh checkout works.
 */
async function writeFile(data: CacheFile): Promise<void> {
  try {
    await fs.mkdir(path.dirname(KIS_CACHE_FILE), { recursive: true });
    // Direct write (no temp+rename) — cross-platform incl. Windows. mode 0o600
    // restricts to the owner where the FS honors it (no-op on Windows).
    await fs.writeFile(KIS_CACHE_FILE, JSON.stringify(data), { mode: 0o600 });
  } catch (e) {
    console.error(
      `[KIS] 토큰 캐시 저장 실패 (${KIS_CACHE_FILE}). 재시작 시 토큰이 다시 발급됩니다:`,
      e instanceof Error ? e.message : e,
    );
  }
}

function valid(entry: CacheEntry | undefined, now: number): string | null {
  return entry && typeof entry.token === "string" && now < entry.expiresAt
    ? entry.token
    : null;
}

/**
 * Return a still-valid cached secret for `key`, or null. Order: memory →
 * Supabase (shared/durable) → file. A hit is promoted into memory (and backfilled
 * to the other layers) so the token is reused everywhere instead of re-issued.
 */
export async function readCachedSecret(key: string): Promise<string | null> {
  const now = Date.now();

  const mem = memory.get(key);
  if (mem && now < mem.expiresAt) return mem.token;

  // Shared layer first so a token issued by ANY instance is reused here.
  const sb = await readSupabase();
  const sbHit = sb ? valid(sb[key], now) : null;
  if (sb && sbHit) {
    memory.set(key, sb[key]);
    return sbHit;
  }

  const file = await readFile();
  const fileHit = valid(file[key], now);
  if (fileHit) {
    memory.set(key, file[key]);
    // Backfill the shared layer so other instances reuse it too.
    if (sb) void writeSupabase({ ...sb, [key]: file[key] });
    return fileHit;
  }
  return null;
}

/**
 * Persist `token` for `key` until `expiresAt` (epoch ms) across ALL layers
 * (memory + Supabase + file) so a restart / other instance reuses it.
 */
export async function writeCachedSecret(
  key: string,
  token: string,
  expiresAt: number,
): Promise<void> {
  const entry: CacheEntry = { token, expiresAt };
  memory.set(key, entry);
  // Merge into the shared store (read-modify-write) so both keys coexist.
  const sb = (await readSupabase()) ?? {};
  await writeSupabase({ ...sb, [key]: entry });
  const file = await readFile();
  file[key] = entry;
  await writeFile(file);
}

/**
 * Forget a cached secret across all layers. Used to self-heal a stale value —
 * e.g. an approval key the realtime socket rejected — so the next call re-issues.
 */
export async function invalidateCachedSecret(key: string): Promise<void> {
  memory.delete(key);
  const sb = await readSupabase();
  if (sb && sb[key]) {
    delete sb[key];
    await writeSupabase(sb);
  }
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
