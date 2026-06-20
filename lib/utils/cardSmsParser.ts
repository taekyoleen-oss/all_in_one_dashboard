/**
 * ============================================================================
 *  cardSmsParser — low-level Korean card SMS/email field extraction (설계서 §4.3, §6.4)
 * ============================================================================
 *
 *  Pure, deterministic helpers. Given a raw Korean card-company notification
 *  (SMS or email body), pull out the fields a transaction needs: 금액(amount),
 *  가맹점(merchant), 일시(txn_date), and optionally 카드 끝 4자리(last4) + 카드사
 *  (issuer). NO LLM here — the spec assigns "패턴 확정 후 결정론적 파싱" to code
 *  (§4.3); the optional Haiku field-extraction fallback for unknown formats is a
 *  later, separate concern. This module never fabricates: a field that can't be
 *  found stays `undefined`, and the caller decides what to do.
 *
 *  Privacy: only the last 4 digits of a card are ever extracted. A full card
 *  number is never parsed out, returned, or stored (CLAUDE.md D5 guardrail).
 *  Callers must never log the raw text or extracted values.
 *
 *  Korean card SMS shapes this handles (a representative, non-exhaustive set):
 *    "[Web발신] 신한카드(1234) 03/15 14:22 12,500원 일시불 스타벅스코리아"
 *    "KB국민카드 승인 5,500원 (일시불) 03/15 09:01 GS25 카드 ****1234"
 *    "삼성카드 승인 홍길동 35,000원 03월15일 14:30 쿠팡"
 *    "현대카드 승인 1,200원 카카오T 잔액 ... 02/28 18:45"
 * ============================================================================
 */

/** A unit-priced money figure pulled from text. */
export interface ParsedAmount {
  /** Numeric amount in KRW (commas stripped). */
  value: number;
  /** Raw matched token (e.g. "12,500원") — for debugging the matcher only. */
  raw: string;
}

/** The fields a parser can recover from one notification. */
export interface ParsedCardFields {
  /** Amount in KRW. */
  amount?: number;
  /** Merchant / 가맹점 name. */
  merchant?: string;
  /** Transaction timestamp as ISO yyyy-mm-dd (date granularity; SMS rarely gives year). */
  txn_date?: string;
  /** Last 4 digits of the card, when present (never the full number). */
  last4?: string;
  /** Canonical issuer key (e.g. "신한", "국민") when recognizable. */
  issuer?: string;
}

/**
 * Known Korean card issuers → a canonical short key + the substrings that
 * identify them in a message. Order matters only for display; matching scans all.
 */
const ISSUERS: { key: string; patterns: RegExp[] }[] = [
  { key: "신한", patterns: [/신한/, /\bShinhan\b/i] },
  { key: "국민", patterns: [/국민/, /\bKB\b/, /KB국민/] },
  { key: "삼성", patterns: [/삼성/, /\bSamsung\b/i] },
  { key: "현대", patterns: [/현대/, /\bHyundai\b/i] },
  { key: "롯데", patterns: [/롯데/, /\bLotte\b/i] },
  { key: "하나", patterns: [/하나/, /\bHana\b/i] },
  { key: "우리", patterns: [/우리/, /\bWoori\b/i] },
  { key: "농협", patterns: [/농협/, /\bNH\b/] },
  { key: "비씨", patterns: [/비씨/, /\bBC카드\b/, /\bBC\b/] },
  { key: "카카오뱅크", patterns: [/카카오뱅크/, /카카오\s?페이/] },
  { key: "토스", patterns: [/토스/, /\bToss\b/i] },
];

/** Words that indicate this is an APPROVAL (승인), not a cancellation/etc. */
const APPROVAL_HINT = /승인|일시불|할부|체크승인|결제/;
/** Words indicating a cancellation / refund (negative or skip). */
const CANCEL_HINT = /취소|승인취소|환불/;

/**
 * Tokens that frequently sit between the amount and the merchant and should be
 * stripped when isolating the merchant name.
 */
const NOISE_TOKENS = [
  /일시불/g,
  /할부/g,
  /\d+개월/g,
  /승인/g,
  /체크/g,
  /누적/g,
  /잔액[\s\S]*$/g, // anything after a balance mention is not the merchant
  /\[?Web발신\]?/gi,
  /\(?국내\)?/g,
  /\(?해외\)?/g,
];

/** Strip leading "[Web발신]" / "[국제발신]" style prefixes. */
function stripChannelPrefix(text: string): string {
  return text.replace(/^\s*\[[^\]]*\]\s*/g, "").trim();
}

/**
 * Find the (first) KRW amount. Prefers a "<digits>원" token; falls back to a
 * bare grouped number near a 승인/결제 keyword. Returns null when none found.
 */
export function extractAmount(text: string): ParsedAmount | null {
  // Primary: "12,500원" / "12500 원".
  const won = text.match(/([0-9][0-9,]*)\s*원/);
  if (won) {
    const value = Number(won[1].replace(/,/g, ""));
    if (Number.isFinite(value) && value > 0) {
      return { value, raw: won[0].trim() };
    }
  }
  // Fallback: a grouped figure of 3+ digits (avoid matching dates/times).
  const grouped = text.match(/(?<![\d/:.])([0-9]{1,3}(?:,[0-9]{3})+)(?![\d/:.])/);
  if (grouped) {
    const value = Number(grouped[1].replace(/,/g, ""));
    if (Number.isFinite(value) && value > 0) {
      return { value, raw: grouped[1] };
    }
  }
  return null;
}

/** Extract the last 4 digits of a card from "(1234)" / "****1234" / "1234*" patterns. */
export function extractLast4(text: string): string | undefined {
  // "****1234" or "**** 1234"
  const masked = text.match(/[*●·]{2,}\s*([0-9]{4})\b/);
  if (masked) return masked[1];
  // "(1234)" right after a card-name-ish token
  const paren = text.match(/\(([0-9]{4})\)/);
  if (paren) return paren[1];
  // "카드 1234" / "끝자리 1234"
  const labeled = text.match(/(?:끝자리|뒷자리|카드)\s*([0-9]{4})\b/);
  if (labeled) return labeled[1];
  return undefined;
}

/** Identify the issuer key, if any well-known card brand appears. */
export function extractIssuer(text: string): string | undefined {
  for (const { key, patterns } of ISSUERS) {
    if (patterns.some((re) => re.test(text))) return key;
  }
  return undefined;
}

/**
 * Extract a transaction date as ISO yyyy-mm-dd. SMS usually gives MM/DD or
 * MM월DD일 without a year — we attach the current year, rolling back one year
 * if that would put the date in the future (e.g. a late-December message parsed
 * in early January). Returns undefined when no date is found.
 */
export function extractDate(text: string, now: Date = new Date()): string | undefined {
  let mm: number | undefined;
  let dd: number | undefined;
  let yyyy: number | undefined;

  // yyyy-mm-dd or yyyy.mm.dd or yyyy/mm/dd (full date, e.g. from CSV-ish text)
  const full = text.match(/(20\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (full) {
    yyyy = Number(full[1]);
    mm = Number(full[2]);
    dd = Number(full[3]);
  } else {
    // MM/DD or MM.DD or MM-DD
    const slash = text.match(/(?<!\d)(\d{1,2})[./-](\d{1,2})(?!\d)/);
    // MM월DD일
    const kor = text.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
    if (kor) {
      mm = Number(kor[1]);
      dd = Number(kor[2]);
    } else if (slash) {
      mm = Number(slash[1]);
      dd = Number(slash[2]);
    }
  }

  if (mm === undefined || dd === undefined) return undefined;
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return undefined;

  if (yyyy === undefined) {
    yyyy = now.getFullYear();
    // If MM/DD is in the future relative to now, it almost certainly belongs to
    // last year (year-boundary messages).
    const candidate = new Date(yyyy, mm - 1, dd);
    if (candidate.getTime() > now.getTime() + 24 * 3600 * 1000) {
      yyyy -= 1;
    }
  }

  const iso = `${yyyy.toString().padStart(4, "0")}-${mm
    .toString()
    .padStart(2, "0")}-${dd.toString().padStart(2, "0")}`;
  return iso;
}

/**
 * Best-effort merchant name. Heuristic: take the text AFTER the amount token
 * (merchants usually trail the amount in KR card SMS), strip noise tokens, times,
 * card masks and the issuer name, and return the cleaned remainder. If nothing
 * sensible remains, try the text before the amount. Returns undefined when
 * nothing usable is left.
 */
export function extractMerchant(
  text: string,
  amountRaw?: string,
): string | undefined {
  const cleaned = stripChannelPrefix(text);

  const pickFrom = (segment: string): string | undefined => {
    let s = segment;
    // Drop times "14:22" / "14시22분" and standalone date fragments.
    s = s.replace(/\d{1,2}:\d{2}(?::\d{2})?/g, " ");
    s = s.replace(/\d{1,2}\s*월\s*\d{1,2}\s*일/g, " ");
    s = s.replace(/(20\d{2})?[.\-/]?\d{1,2}[./-]\d{1,2}/g, " ");
    s = s.replace(/\d{1,2}시\d{1,2}분/g, " ");
    // Drop card masks and amounts.
    s = s.replace(/[*●·]{2,}\s*\d{4}\b/g, " ");
    s = s.replace(/\(\d{4}\)/g, " ");
    s = s.replace(/[0-9][0-9,]*\s*원/g, " ");
    // Drop issuer names and "카드".
    for (const { patterns } of ISSUERS) {
      for (const re of patterns) s = s.replace(new RegExp(re.source, "g"), " ");
    }
    s = s.replace(/카드/g, " ");
    // Drop generic noise tokens.
    for (const re of NOISE_TOKENS) s = s.replace(re, " ");
    // Names like "홍길동 님" — a Korean personal name + 님; drop the honorific.
    s = s.replace(/님\b/g, " ");
    // Collapse whitespace, trim punctuation.
    s = s.replace(/[()[\]{}<>]/g, " ").replace(/\s+/g, " ").trim();
    // Strip leftover leading/trailing separators.
    s = s.replace(/^[-·,.\s]+|[-·,.\s]+$/g, "").trim();
    return s.length >= 2 ? s : undefined;
  };

  if (amountRaw) {
    const idx = cleaned.indexOf(amountRaw);
    if (idx >= 0) {
      const after = cleaned.slice(idx + amountRaw.length);
      const fromAfter = pickFrom(after);
      if (fromAfter) return fromAfter;
      const before = cleaned.slice(0, idx);
      const fromBefore = pickFrom(before);
      if (fromBefore) return fromBefore;
    }
  }
  return pickFrom(cleaned);
}

/** True when the message looks like an approval (vs cancel/info). */
export function looksLikeApproval(text: string): boolean {
  return APPROVAL_HINT.test(text) && !CANCEL_HINT.test(text);
}

/** True when the message is a cancellation/refund. */
export function looksLikeCancellation(text: string): boolean {
  return CANCEL_HINT.test(text);
}

/**
 * Run all extractors over `text`. Pure aggregation — no decision about whether
 * the result is "good enough"; that belongs to the higher-level parser.
 */
export function extractCardFields(
  text: string,
  now: Date = new Date(),
): ParsedCardFields {
  const amount = extractAmount(text);
  const merchant = extractMerchant(text, amount?.raw);
  const txn_date = extractDate(text, now);
  const last4 = extractLast4(text);
  const issuer = extractIssuer(text);

  return {
    amount: amount?.value,
    merchant,
    txn_date,
    last4,
    issuer,
  };
}
