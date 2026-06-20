/**
 * csv — a tiny, dependency-free RFC-4180-ish CSV reader (설계서 §6.4 CSV 가져오기).
 *
 *  parseCsv(text) → array of rows, each an array of string cells. Handles:
 *    • quoted fields ("a,b") with embedded commas and newlines,
 *    • escaped quotes inside quotes ("" → "),
 *    • both CRLF and LF line endings,
 *    • a leading UTF-8 BOM (common in card-company exports).
 *
 *  Deliberately small and synchronous — card CSVs are short. No type coercion:
 *  every cell is returned as a trimmed-of-surrounding-quotes string; the caller
 *  (the import route) maps columns and parses amounts/dates. Trailing empty final
 *  line is dropped.
 */

/** Parse CSV `text` into rows of string cells. */
export function parseCsv(text: string): string[][] {
  // Strip a UTF-8 BOM if present.
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"'; // escaped quote
          i++;
        } else {
          inQuotes = false; // closing quote
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch === "\r") {
      // Handle CRLF: swallow the \r; the \n (next iter) ends the row. A lone \r
      // (old Mac) also ends the row.
      if (input[i + 1] !== "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      }
    } else {
      field += ch;
    }
  }

  // Flush the final field/row if the file didn't end with a newline.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

export default parseCsv;
