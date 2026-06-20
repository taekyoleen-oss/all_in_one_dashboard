/**
 * ============================================================================
 *  cardParser — parse one card notification → a transaction (설계서 §4.3, §6.4)
 * ============================================================================
 *
 *  SERVER-ONLY orchestration over the deterministic field extractors in
 *  lib/utils/cardSmsParser.ts. Given raw Korean card SMS/email text it returns
 *  either:
 *    • { status: 'recognized', txn }    — amount + a usable date were found, OR
 *    • { status: 'unrecognized', raw }  — could not parse confidently.
 *
 *  NO-LOSS PRINCIPLE (§6.4): the parser NEVER fabricates a transaction. When it
 *  can't recognize the format it returns `unrecognized` and the caller still
 *  stores the row with a sentinel category ('미인식') so the user can fix it
 *  later — nothing is dropped. The hard requirement for "recognized" is an
 *  amount (a money charge with no amount is meaningless); a missing date falls
 *  back to "today" only when an amount IS present, since the dedupe hash needs a
 *  date and a dated charge is still useful.
 *
 *  DEDUPE: `raw_hash` = sha-256 of `일시|금액|가맹점` (normalized). The DB has a
 *  `unique(user_id, raw_hash)` index, so re-sending the same SMS (the forwarder
 *  retries, or CSV overlaps an SMS) is an upsert no-op. The hash is computed from
 *  the SAME three fields whether the row was recognized or stored as 미인식, so a
 *  later re-send of an unrecognized message still dedupes.
 *
 *  PRIVACY: only last4 is ever surfaced; the raw text and parsed values are
 *  never logged. The merchant snippet kept for an unrecognized row is a trimmed
 *  prefix of the message (so the user can recognize it), not the whole body.
 * ============================================================================
 */

import { createHash } from "node:crypto";
import {
  extractCardFields,
  looksLikeCancellation,
  type ParsedCardFields,
} from "@/lib/utils/cardSmsParser";

/** Category sentinel for a row we stored without confident parsing (no-loss). */
export const UNRECOGNIZED_CATEGORY = "미인식";

/** Max length of the raw snippet we keep as the merchant for an unrecognized row. */
const SNIPPET_MAX = 80;

/**
 * The normalized transaction a parse yields. Mirrors the insertable columns of
 * `pb_card_transactions` MINUS the server-owned ids/user — the route attaches
 * `card_id`, `user_id`, and `source`.
 */
export interface ParsedTransaction {
  /** Amount in KRW. For a cancellation we keep it positive but tag the category. */
  amount: number;
  /** Merchant / 가맹점, or a trimmed raw snippet for unrecognized rows. */
  merchant: string;
  /** ISO yyyy-mm-dd. */
  txn_date: string;
  /** Category — a coarse guess, or the 미인식 sentinel. */
  category: string;
  /** sha-256 dedupe key over 일시|금액|가맹점. */
  raw_hash: string;
  /** Last 4 digits, when the message carried them (never the full PAN). */
  last4?: string;
  /** Canonical issuer key, when recognizable. */
  issuer?: string;
}

export type ParseResult =
  | { status: "recognized"; txn: ParsedTransaction }
  | { status: "unrecognized"; txn: ParsedTransaction };

/**
 * Build the dedupe hash from the three identity fields. Inputs are normalized
 * (trimmed, amount as a plain integer string) so trivial formatting differences
 * between two copies of the same notification hash identically.
 */
export function buildRawHash(
  txn_date: string,
  amount: number,
  merchant: string,
): string {
  const norm = `${txn_date.trim()}|${Math.round(amount)}|${merchant.trim().toLowerCase()}`;
  return createHash("sha256").update(norm, "utf8").digest("hex");
}

/** Today as ISO yyyy-mm-dd in the server's local time. */
function todayIso(now: Date): string {
  return `${now.getFullYear().toString().padStart(4, "0")}-${(now.getMonth() + 1)
    .toString()
    .padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}`;
}

/** A short, single-line snippet of the raw text (for an unrecognized row's merchant). */
function snippet(text: string): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > SNIPPET_MAX
    ? `${oneLine.slice(0, SNIPPET_MAX - 1)}…`
    : oneLine || "(빈 메시지)";
}

/**
 * Very coarse category guess from the merchant string. Deliberately tiny — the
 * user re-categorizes in the widget. Returns "기타" when nothing matches.
 */
export function guessCategory(merchant: string | undefined): string {
  if (!merchant) return "기타";
  const m = merchant.toLowerCase();
  const rules: { cat: string; re: RegExp }[] = [
    { cat: "식비", re: /스타벅스|카페|커피|배달|배민|요기요|식당|김밥|맥도날드|버거|치킨|coffee|cafe/i },
    { cat: "편의점/마트", re: /gs25|cu|세븐일레븐|이마트|홈플러스|롯데마트|마트|편의점|emart/i },
    { cat: "교통", re: /택시|카카오t|지하철|버스|주유|gs칼텍스|sk에너지|코레일|기차|ktx/i },
    { cat: "쇼핑", re: /쿠팡|11번가|지마켓|옥션|네이버페이|무신사|올리브영|coupang/i },
    { cat: "구독/문화", re: /넷플릭스|netflix|유튜브|youtube|멜론|스포티파이|왓챠|cgv|메가박스/i },
  ];
  for (const { cat, re } of rules) if (re.test(m)) return cat;
  return "기타";
}

/**
 * Parse one notification body into a transaction result.
 *
 * @param text  Raw SMS/email body.
 * @param now   Injectable clock (tests pass a fixed date). Defaults to new Date().
 */
export function parseCardMessage(
  text: string,
  now: Date = new Date(),
): ParseResult {
  const fields: ParsedCardFields = extractCardFields(text, now);
  const isCancel = looksLikeCancellation(text);

  // RECOGNIZED requires an amount. (A charge with no amount is not a transaction.)
  if (typeof fields.amount === "number" && fields.amount > 0) {
    const txn_date = fields.txn_date ?? todayIso(now);
    const merchant = fields.merchant ?? "(가맹점 미상)";
    const category = isCancel ? "취소" : guessCategory(fields.merchant);
    return {
      status: "recognized",
      txn: {
        amount: fields.amount,
        merchant,
        txn_date,
        category,
        raw_hash: buildRawHash(txn_date, fields.amount, merchant),
        last4: fields.last4,
        issuer: fields.issuer,
      },
    };
  }

  // UNRECOGNIZED — store with the 미인식 sentinel so nothing is lost (§6.4). We
  // still produce a transaction so the route can insert it; amount defaults to 0
  // (the user fixes it), and the hash is over date|0|snippet so an identical
  // re-send dedupes.
  const txn_date = fields.txn_date ?? todayIso(now);
  const merchant = snippet(text);
  const amount = 0;
  return {
    status: "unrecognized",
    txn: {
      amount,
      merchant,
      txn_date,
      category: UNRECOGNIZED_CATEGORY,
      raw_hash: buildRawHash(txn_date, amount, merchant),
      last4: fields.last4,
      issuer: fields.issuer,
    },
  };
}

export default parseCardMessage;
