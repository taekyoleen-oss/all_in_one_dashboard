/**
 * vCard (.vcf) parser — import phone contacts on platforms WITHOUT the Web
 * Contact Picker API (iPhone, desktop). Android Chrome uses the native picker
 * (navigator.contacts) instead; this is the universal fallback.
 *
 *  Handles the awkward bits real exports contain:
 *    • line folding (continuation lines beginning with a space/tab)
 *    • QUOTED-PRINTABLE soft line breaks ("=" at end of line) + =XX bytes,
 *      decoded as UTF-8 — Korean Android exports use this for 한글 names
 *    • property groups ("item1.TEL"), params ("TEL;TYPE=CELL"), and value escapes
 *  Extracts only what the widget needs: name / phone / email / memo.
 */

export interface ParsedContact {
  name: string;
  phone: string;
  email: string;
  memo: string;
}

/** Unescape vCard text values (\n \, \; \\). */
function unescapeValue(v: string): string {
  return v
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

/** Decode quoted-printable (=XX bytes) as UTF-8. */
function decodeQuotedPrintable(input: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === "=" && i + 2 < input.length) {
      const hex = input.slice(i + 1, i + 3);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(parseInt(hex, 16));
        i += 2;
        continue;
      }
    }
    bytes.push(ch.charCodeAt(0) & 0xff);
  }
  try {
    return new TextDecoder("utf-8").decode(new Uint8Array(bytes));
  } catch {
    return input;
  }
}

interface VLine {
  key: string;
  isQuotedPrintable: boolean;
  value: string;
}

function parseLine(line: string): VLine | null {
  const colon = line.indexOf(":");
  if (colon < 0) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const segments = head.split(";");
  let key = (segments.shift() ?? "").trim().toUpperCase();
  if (!key) return null;
  // Drop a property group prefix, e.g. "item1.TEL" → "TEL".
  key = key.split(".").pop() ?? key;
  const isQuotedPrintable = segments.some((s) =>
    s.toUpperCase().includes("QUOTED-PRINTABLE"),
  );
  return { key, isQuotedPrintable, value };
}

/** Structured N (Family;Given;…) → "홍길동" (Korean) or "John Doe". */
function nameFromN(value: string): string {
  const [family = "", given = ""] = value.split(";");
  const f = family.trim();
  const g = given.trim();
  if (!f && !g) return "";
  const isKorean = /[가-힣]/.test(f + g);
  return isKorean ? `${f}${g}` : [g, f].filter(Boolean).join(" ");
}

export function parseVCards(text: string): ParsedContact[] {
  // Normalize newlines, drop QP soft breaks ("=" + newline), then unfold
  // continuation lines (those starting with a space or tab).
  const unfolded = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/=\n/g, "")
    .replace(/\n[ \t]/g, "");

  const blocks = unfolded.split(/BEGIN:VCARD/i).slice(1);
  const out: ParsedContact[] = [];

  for (const block of blocks) {
    const body = block.split(/END:VCARD/i)[0] ?? "";
    let fn = "";
    let n = "";
    let phone = "";
    let email = "";
    let memo = "";

    for (const rawLine of body.split("\n")) {
      const line = rawLine.trim();
      if (!line) continue;
      const parsed = parseLine(line);
      if (!parsed) continue;
      const value = parsed.isQuotedPrintable
        ? decodeQuotedPrintable(parsed.value)
        : parsed.value;

      switch (parsed.key) {
        case "FN":
          if (!fn) fn = unescapeValue(value).trim();
          break;
        case "N":
          if (!n) n = nameFromN(value);
          break;
        case "TEL":
          if (!phone) phone = value.trim();
          break;
        case "EMAIL":
          if (!email) email = value.trim();
          break;
        case "NOTE":
          if (!memo) memo = unescapeValue(value).trim();
          break;
        default:
          break;
      }
    }

    const name = fn || n;
    if (name || phone || email) out.push({ name, phone, email, memo });
  }

  return out;
}
