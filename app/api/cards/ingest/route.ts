/**
 * ============================================================================
 *  POST /api/cards/ingest — per-user token card ingest (설계서 §6.4, §5.3)
 * ============================================================================
 *
 *  The phone (Android SMS-forwarding app: SMS Forwarder / MacroDroid / Tasker)
 *  or an email forwarder POSTs a raw card notification here. This endpoint is
 *  NOT session-authenticated — the caller is an automation with no cookie. It
 *  authenticates by a **per-user secret token** and resolves the owning user via
 *  the **service-role (admin) client**, then writes that user's transaction.
 *
 *  AUTH (token, not session):
 *    1. Read the token from `x-ingest-token` header (preferred) or JSON body.
 *    2. Look up `pb_user_settings.ingest_token = token` with the admin client
 *       (RLS-bypassing — there is no session). A miss → 401, with NO hint about
 *       which part failed and no echo of the token.
 *    3. Every subsequent write is scoped to the RESOLVED `user_id` from that row
 *       (never to any id taken from the request).
 *
 *  PARSE + NO-LOSS (§6.4): the body text is parsed by lib/api/cardParser. On a
 *  recognized charge we insert the transaction; on an UNRECOGNIZED format we
 *  still insert it with category '미인식' (merchant = a trimmed raw snippet) so
 *  the user can fix it later — nothing is ever dropped.
 *
 *  DEDUP: insert is an upsert on the `unique(user_id, raw_hash)` index with
 *  `ignoreDuplicates` — a re-sent SMS (the forwarder retries) returns zero rows,
 *  which we report as `status:'duplicate'`. The hash is over 일시|금액|가맹점.
 *
 *  TARGET CARD: `card_id` is NOT NULL, so a transaction needs a card. We attach
 *  to the user's card whose `last4` matches the SMS (when present), else their
 *  first card. If the user has NO cards yet, we auto-provision a placeholder
 *  "인제스트 미분류" card (scoped to the resolved user_id) so ingest never fails
 *  for a not-yet-configured user — they re-assign later in the widget.
 *
 *  PRIVACY: the response is minimal JSON (ok/status/category) — it NEVER echoes
 *  the token, the raw text, the amount, the merchant, or last4. Card data and
 *  secrets are never logged.
 *
 *  Route Handler (Next.js 16): Web Request in, Response.json out. Reads the body
 *  + headers, so it is inherently dynamic; never cached.
 * ============================================================================
 */

import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseCardMessage } from "@/lib/api/cardParser";
import {
  CardIngestResponseSchema,
  type CardIngestResponse,
  type CardTxnSource,
} from "@/output/api-shapes";

/** Never cache an ingest POST. */
const NO_STORE = { "cache-control": "no-store" } as const;

/** Placeholder card name for users who ingest before registering any card. */
const FALLBACK_CARD_NICKNAME = "인제스트 미분류";

/** Small typed JSON helper that always disables caching. */
function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: NO_STORE });
}

/** Shape we accept in the request body (all optional except the text). */
interface IngestBody {
  text?: unknown;
  message?: unknown;
  body?: unknown;
  token?: unknown;
  source?: unknown;
}

/** Pull the first usable string field from the parsed body. */
function pickText(b: IngestBody): string | null {
  for (const v of [b.text, b.message, b.body]) {
    if (typeof v === "string" && v.trim().length > 0) return v;
  }
  return null;
}

export async function POST(request: NextRequest): Promise<Response> {
  // ---- read body (JSON or raw text) -------------------------------------
  const contentType = request.headers.get("content-type") ?? "";
  let bodyText: string | null = null;
  let bodyToken: string | null = null;
  let bodySource: CardTxnSource | null = null;

  if (contentType.includes("application/json")) {
    let parsedBody: IngestBody;
    try {
      parsedBody = (await request.json()) as IngestBody;
    } catch {
      return json({ ok: false, status: "unrecognized", error: "bad_json" }, 400);
    }
    bodyText = pickText(parsedBody);
    if (typeof parsedBody.token === "string") bodyToken = parsedBody.token;
    if (parsedBody.source === "sms" || parsedBody.source === "email") {
      bodySource = parsedBody.source;
    }
  } else {
    // text/plain (or anything else): the whole body is the message.
    const raw = await request.text();
    bodyText = raw.trim().length > 0 ? raw : null;
  }

  // ---- token auth (header preferred, body fallback) ---------------------
  const headerToken = request.headers.get("x-ingest-token");
  const token = (headerToken ?? bodyToken ?? "").trim();
  if (!token) {
    return json({ ok: false, status: "unrecognized", error: "missing_token" }, 401);
  }
  if (!bodyText) {
    return json({ ok: false, status: "unrecognized", error: "missing_text" }, 400);
  }

  const source: CardTxnSource = bodySource ?? "sms";

  // ---- resolve the owning user via the admin client (RLS bypass) --------
  const admin = createAdminClient();

  const { data: settings, error: settingsErr } = await admin
    .from("pb_user_settings")
    .select("user_id")
    .eq("ingest_token", token)
    .maybeSingle();

  if (settingsErr) {
    // Generic failure — do not leak DB details or the token.
    return json({ ok: false, status: "unrecognized", error: "server_error" }, 500);
  }
  if (!settings) {
    // Unknown/invalid token. No hint, no echo.
    return json({ ok: false, status: "unrecognized", error: "unauthorized" }, 401);
  }

  const userId = settings.user_id;

  // ---- parse the message (deterministic; never fabricates) --------------
  const result = parseCardMessage(bodyText);
  const { txn } = result;

  // ---- resolve a target card (NOT NULL FK) ------------------------------
  const cardId = await resolveCardId(admin, userId, txn.last4 ?? null);
  if (!cardId) {
    return json({ ok: false, status: "unrecognized", error: "server_error" }, 500);
  }

  // ---- insert with dedup (upsert on unique(user_id, raw_hash)) ----------
  // ignoreDuplicates → a re-sent SMS returns zero rows = duplicate.
  const { data: inserted, error: insertErr } = await admin
    .from("pb_card_transactions")
    .upsert(
      {
        user_id: userId,
        card_id: cardId,
        txn_date: txn.txn_date,
        merchant: txn.merchant,
        amount: txn.amount,
        category: txn.category,
        source,
        raw_hash: txn.raw_hash,
      },
      { onConflict: "user_id,raw_hash", ignoreDuplicates: true },
    )
    .select("id");

  if (insertErr) {
    return json({ ok: false, status: "unrecognized", error: "server_error" }, 500);
  }

  const wasDuplicate = !inserted || inserted.length === 0;

  const response: CardIngestResponse = wasDuplicate
    ? { ok: true, status: "duplicate" }
    : {
        ok: true,
        status: result.status, // 'recognized' | 'unrecognized'
        category: txn.category,
      };

  // Validate our own output against the shared schema (anti-drift).
  const safe = CardIngestResponseSchema.safeParse(response);
  return json(safe.success ? safe.data : response, 200);
}

/**
 * Find a card to attach the transaction to, in priority order:
 *   1. the user's card whose last4 matches the SMS (when the SMS gave one),
 *   2. the user's first card (any),
 *   3. an auto-provisioned "인제스트 미분류" placeholder (created if missing).
 *
 * All queries/writes are explicitly scoped to `userId` (admin client bypasses
 * RLS, so the scope MUST be explicit). Returns the card id, or null on failure.
 */
async function resolveCardId(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  last4: string | null,
): Promise<string | null> {
  // 1) match by last4
  if (last4) {
    const { data: byLast4 } = await admin
      .from("pb_cards")
      .select("id")
      .eq("user_id", userId)
      .eq("last4", last4)
      .limit(1)
      .maybeSingle();
    if (byLast4) return byLast4.id;
  }

  // 2) any existing card (prefer the placeholder if it already exists, else first)
  const { data: existing } = await admin
    .from("pb_cards")
    .select("id, nickname")
    .eq("user_id", userId)
    .order("nickname", { ascending: true })
    .limit(50);

  if (existing && existing.length > 0) {
    const placeholder = existing.find((c) => c.nickname === FALLBACK_CARD_NICKNAME);
    return (placeholder ?? existing[0]).id;
  }

  // 3) provision a placeholder card (scoped to the resolved user)
  const { data: created, error: createErr } = await admin
    .from("pb_cards")
    .insert({ user_id: userId, nickname: FALLBACK_CARD_NICKNAME })
    .select("id")
    .single();

  if (createErr || !created) return null;
  return created.id;
}
