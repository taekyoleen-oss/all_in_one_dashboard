/**
 * ============================================================================
 *  POST /api/cards/import — CSV import of card transactions (설계서 §6.4, §5.4)
 * ============================================================================
 *
 *  Authenticated by the SIGNED-IN SESSION (lib/supabase/server.ts) — unlike the
 *  token-based ingest route. The user downloads their card-company usage CSV,
 *  uploads it here, and rows are written into THEIR OWN `pb_card_transactions`
 *  (RLS-scoped: every write carries `user_id = auth.uid()` and the policy also
 *  double-checks the parent card ownership). The service-role client is NOT used
 *  here — RLS does the scoping.
 *
 *  INPUT: either `multipart/form-data` with a `file` field (+ optional `card_id`),
 *  or a JSON body `{ csv: string, card_id?: string }`. The CSV is parsed with a
 *  small RFC-4180-ish reader (quoted fields, embedded commas/newlines). Columns
 *  are mapped from common Korean card headers (이용일/가맹점/금액/…); the amount
 *  and date columns are required per row.
 *
 *  TARGET CARD: `card_id` is NOT NULL. The caller may pass a `card_id` (the
 *  widget sends the selected card); we verify it belongs to the user. If omitted,
 *  we use the user's first card. With no cards, the import is rejected (the
 *  widget asks the user to register a card first) — CSV import is interactive, so
 *  failing fast is fine (unlike unattended ingest, which auto-provisions).
 *
 *  DEDUP: `raw_hash` (일시|금액|가맹점) + upsert with `ignoreDuplicates`, so a CSV
 *  that overlaps already-ingested SMS rows skips the duplicates. Report counts.
 *
 *  PRIVACY: never logs row contents; reports only aggregate counts.
 * ============================================================================
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildRawHash, guessCategory } from "@/lib/api/cardParser";
import { parseCsv } from "@/lib/utils/csv";
import {
  CardImportResponseSchema,
  type CardImportResponse,
} from "@/output/api-shapes";

const NO_STORE = { "cache-control": "no-store" } as const;

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: NO_STORE });
}

/** Candidate header names (lower-cased, spaces stripped) → our field. */
const COLUMN_ALIASES: Record<"date" | "merchant" | "amount" | "category", string[]> = {
  date: ["이용일", "거래일", "거래일자", "이용일자", "승인일", "승인일자", "날짜", "date", "txn_date", "transactiondate"],
  merchant: ["가맹점", "가맹점명", "이용처", "내용", "적요", "상호", "merchant", "store", "description"],
  amount: ["금액", "이용금액", "승인금액", "결제금액", "거래금액", "amount", "price"],
  category: ["카테고리", "분류", "업종", "category", "type"],
};

/** Normalize a header cell for matching. */
function normHeader(h: string): string {
  return h.replace(/\s+/g, "").replace(/["']/g, "").toLowerCase();
}

/** Build a header→index map for the columns we care about. */
function mapColumns(header: string[]): {
  date: number;
  merchant: number;
  amount: number;
  category: number;
} {
  const norm = header.map(normHeader);
  const find = (aliases: string[]): number => {
    for (let i = 0; i < norm.length; i++) {
      if (aliases.some((a) => norm[i] === a || norm[i].includes(a))) return i;
    }
    return -1;
  };
  return {
    date: find(COLUMN_ALIASES.date),
    merchant: find(COLUMN_ALIASES.merchant),
    amount: find(COLUMN_ALIASES.amount),
    category: find(COLUMN_ALIASES.category),
  };
}

/** Parse a Korean-style amount cell ("12,500", "12,500원", "-3,000", "(3,000)"). */
function parseAmount(cell: string): number | null {
  const neg = /^\(.*\)$/.test(cell.trim()) || /^-/.test(cell.trim());
  const digits = cell.replace(/[^\d.]/g, "");
  if (!digits) return null;
  const value = Number(digits);
  if (!Number.isFinite(value)) return null;
  return neg ? -value : value;
}

/** Normalize a date cell to ISO yyyy-mm-dd. Accepts yyyy-mm-dd / yyyy.mm.dd / yyyy/mm/dd / mm/dd. */
function parseDate(cell: string): string | null {
  const s = cell.trim();
  const full = s.match(/(20\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (full) {
    const [, y, m, d] = full;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const md = s.match(/(?<!\d)(\d{1,2})[.\-/](\d{1,2})(?!\d)/);
  if (md) {
    const y = new Date().getFullYear();
    return `${y}-${md[1].padStart(2, "0")}-${md[2].padStart(2, "0")}`;
  }
  return null;
}

export async function POST(request: NextRequest): Promise<Response> {
  const supabase = await createClient();

  // ---- session auth -----------------------------------------------------
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  // ---- read CSV text + optional card_id ---------------------------------
  const contentType = request.headers.get("content-type") ?? "";
  let csvText = "";
  let requestedCardId: string | null = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (file && typeof file !== "string") {
      csvText = await file.text();
    } else {
      const inline = form.get("csv");
      if (typeof inline === "string") csvText = inline;
    }
    const cid = form.get("card_id");
    if (typeof cid === "string" && cid) requestedCardId = cid;
  } else if (contentType.includes("application/json")) {
    try {
      const body = (await request.json()) as { csv?: unknown; card_id?: unknown };
      if (typeof body.csv === "string") csvText = body.csv;
      if (typeof body.card_id === "string" && body.card_id) {
        requestedCardId = body.card_id;
      }
    } catch {
      return json({ ok: false, error: "bad_json" }, 400);
    }
  } else {
    csvText = await request.text();
  }

  if (!csvText.trim()) {
    return json({ ok: false, error: "empty_file" }, 400);
  }

  // ---- resolve target card (RLS read; verify ownership) -----------------
  let cardId: string | null = null;
  if (requestedCardId) {
    const { data: owned } = await supabase
      .from("pb_cards")
      .select("id")
      .eq("id", requestedCardId)
      .maybeSingle(); // RLS already restricts to this user's rows
    if (owned) cardId = owned.id;
  }
  if (!cardId) {
    const { data: first } = await supabase
      .from("pb_cards")
      .select("id")
      .order("nickname", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (first) cardId = first.id;
  }
  if (!cardId) {
    return json({ ok: false, error: "no_card" }, 400);
  }

  // ---- parse the CSV ----------------------------------------------------
  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    return json({ ok: false, error: "no_rows" }, 400);
  }
  const [header, ...dataRows] = rows;
  const cols = mapColumns(header);
  if (cols.date === -1 || cols.amount === -1) {
    return json({ ok: false, error: "missing_columns" }, 400);
  }

  type InsertRow = {
    user_id: string;
    card_id: string;
    txn_date: string;
    merchant: string | null;
    amount: number;
    category: string | null;
    source: "csv";
    raw_hash: string;
  };

  const toInsert: InsertRow[] = [];
  const seenHashes = new Set<string>();
  let skippedLocal = 0;

  for (const row of dataRows) {
    if (row.length === 0 || row.every((c) => c.trim() === "")) continue;
    const dateCell = row[cols.date] ?? "";
    const amountCell = row[cols.amount] ?? "";
    const txn_date = parseDate(dateCell);
    const amount = parseAmount(amountCell);
    if (txn_date === null || amount === null) {
      skippedLocal++;
      continue;
    }
    const merchant =
      cols.merchant >= 0 ? (row[cols.merchant] ?? "").trim() || null : null;
    const category =
      cols.category >= 0 && (row[cols.category] ?? "").trim()
        ? row[cols.category].trim()
        : guessCategory(merchant ?? undefined);

    const raw_hash = buildRawHash(txn_date, amount, merchant ?? "");
    // De-dupe within the same file too (a CSV can repeat a line).
    if (seenHashes.has(raw_hash)) {
      skippedLocal++;
      continue;
    }
    seenHashes.add(raw_hash);

    toInsert.push({
      user_id: user.id,
      card_id: cardId,
      txn_date,
      merchant,
      amount,
      category,
      source: "csv",
      raw_hash,
    });
  }

  const totalData = dataRows.filter(
    (r) => r.length > 0 && !r.every((c) => c.trim() === ""),
  ).length;

  if (toInsert.length === 0) {
    const empty: CardImportResponse = {
      ok: true,
      inserted: 0,
      skipped: skippedLocal,
      total: totalData,
    };
    return json(empty, 200);
  }

  // ---- insert with dedup (RLS-scoped upsert) ----------------------------
  const { data: inserted, error: insertErr } = await supabase
    .from("pb_card_transactions")
    .upsert(toInsert, {
      onConflict: "user_id,raw_hash",
      ignoreDuplicates: true,
    })
    .select("id");

  if (insertErr) {
    return json({ ok: false, error: "insert_failed" }, 500);
  }

  const insertedCount = inserted?.length ?? 0;
  const skipped = skippedLocal + (toInsert.length - insertedCount);

  const response: CardImportResponse = {
    ok: true,
    inserted: insertedCount,
    skipped,
    total: totalData,
  };

  const safe = CardImportResponseSchema.safeParse(response);
  return json(safe.success ? safe.data : response, 200);
}
