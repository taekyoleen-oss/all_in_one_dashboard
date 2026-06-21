/**
 * CSV contact parser — import phone contacts exported as CSV (Google 연락처,
 * Outlook, 네이버 주소록 등). Complements vcard.ts (.vcf) so users can bulk-import
 * however their source exports. Column roles are detected by header heuristics in
 * both English and Korean, so most consumer exports "just work".
 *
 *  Handles the messy bits real CSVs contain:
 *    • quoted fields with embedded commas, quotes (""), and newlines
 *    • a UTF-8 BOM at the start of the file
 *    • split name columns (First/Last · Given/Family · 성/이름) vs a single Name
 *    • multiple phone/email columns — the first non-empty wins
 */

import type { ParsedContact } from "./vcard";

/** Tokenize CSV text into rows of string cells (RFC-4180-ish, defensive). */
function parseCsvRows(text: string): string[][] {
  const src = text.replace(/^﻿/, ""); // strip BOM
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      // Treat \r, \n, \r\n as one row break; ignore a trailing empty break.
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    if (row.some((c) => c.trim() !== "")) rows.push(row);
  }
  return rows;
}

/** Find the first column index whose header matches any of the needles. */
function findCol(headers: string[], needles: string[]): number {
  return headers.findIndex((h) => needles.some((n) => h.includes(n)));
}

/** First non-empty cell among the given column indices. */
function firstValue(cells: string[], cols: number[]): string {
  for (const c of cols) {
    if (c >= 0) {
      const v = (cells[c] ?? "").trim();
      if (v) return v;
    }
  }
  return "";
}

/** All non-empty cells among columns whose header includes a needle. */
function colsMatching(headers: string[], needles: string[]): number[] {
  const out: number[] = [];
  headers.forEach((h, i) => {
    if (needles.some((n) => h.includes(n))) out.push(i);
  });
  return out;
}

export function parseContactsCsv(text: string): ParsedContact[] {
  const rows = parseCsvRows(text);
  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => h.trim().toLowerCase());

  // Name: prefer a single full/display-name column; else combine given+family.
  const fullNameCols = colsMatching(headers, [
    "display name",
    "full name",
    "이름",
    "성명",
  ]);
  // A bare "name" column (Google) — but NOT "first/last/given/family name".
  const bareNameCol = headers.findIndex(
    (h) =>
      h === "name" ||
      (h.includes("name") &&
        !/(first|last|given|family|middle|nick|file|account)/.test(h)),
  );
  const givenCol = findCol(headers, ["first name", "given name"]);
  const familyCol = findCol(headers, ["last name", "family name", "성"]);

  const phoneCols = colsMatching(headers, [
    "phone",
    "mobile",
    "tel",
    "전화",
    "휴대",
    "핸드폰",
  ]);
  const emailCols = colsMatching(headers, ["mail", "이메일", "e-메일"]);
  const memoCols = colsMatching(headers, ["note", "memo", "메모", "비고"]);

  const out: ParsedContact[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];

    let name = firstValue(cells, [...fullNameCols, bareNameCol]);
    if (!name) {
      const given = givenCol >= 0 ? (cells[givenCol] ?? "").trim() : "";
      const family = familyCol >= 0 ? (cells[familyCol] ?? "").trim() : "";
      const isKorean = /[가-힣]/.test(family + given);
      name = isKorean
        ? `${family}${given}`
        : [given, family].filter(Boolean).join(" ");
    }

    const phone = firstValue(cells, phoneCols);
    const email = firstValue(cells, emailCols);
    const memo = firstValue(cells, memoCols);

    if (name || phone || email) out.push({ name, phone, email, memo });
  }
  return out;
}
