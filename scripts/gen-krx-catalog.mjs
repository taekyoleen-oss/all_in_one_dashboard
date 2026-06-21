/**
 * gen-krx-catalog.mjs — generate the full KRX (KOSPI+KOSDAQ) stock catalog.
 *
 *  Downloads the official 상장법인목록 from KRX KIND for both markets, parses the
 *  HTML table (회사명 + 종목코드), and writes lib/api/stock/krx-catalog.generated.ts
 *  so EVERY listed stock is searchable by name or code (offline, instant).
 *
 *  KOSPI codes are bare ("005930"); KOSDAQ codes carry ".KQ" so the Yahoo
 *  fallback + provider resolve the right exchange (matches symbols.ts convention).
 *
 *  Run:  node scripts/gen-krx-catalog.mjs
 *  Re-run periodically to refresh listings (new IPOs / delistings).
 */

import { writeFile } from "node:fs/promises";
import path from "node:path";

const MARKETS = [
  { type: "stockMkt", suffix: "" }, // KOSPI → bare 6-digit code
  { type: "kosdaqMkt", suffix: ".KQ" }, // KOSDAQ → .KQ suffix
];

const decodeEntities = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();

async function fetchMarket(type) {
  const url = `http://kind.krx.co.kr/corpgeneral/corpList.do?method=download&searchType=13&marketType=${type}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${type}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return new TextDecoder("euc-kr").decode(buf);
}

/**
 * Parse the KIND HTML table → [{ name, code }].
 * Columns: [0] 회사명 · [1] 시장구분(유가/코스닥) · [2] 종목코드 · … (rest ignored).
 */
function parseRows(html) {
  const rows = [...html.matchAll(/<tr[\s\S]*?<\/tr>/g)].map((m) => m[0]);
  const out = [];
  for (const row of rows) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) =>
      decodeEntities(m[1].replace(/<[^>]*>/g, "").replace(/\s+/g, " ")),
    );
    if (cells.length < 3) continue; // header row has <th>, skipped
    const name = cells[0];
    const code = (cells[2] || "").replace(/\D/g, "").padStart(6, "0");
    if (!name || !/^\d{6}$/.test(code) || code === "000000") continue;
    out.push({ name, code });
  }
  return out;
}

async function main() {
  const all = [];
  for (const { type, suffix } of MARKETS) {
    const html = await fetchMarket(type);
    const rows = parseRows(html);
    console.log(`${type}: ${rows.length} 종목`);
    for (const { name, code } of rows) {
      all.push({ symbol: `${code}${suffix}`, name });
    }
  }
  // De-dupe by symbol (defensive) and sort by name for stable diffs.
  const bySymbol = new Map(all.map((e) => [e.symbol, e]));
  const list = [...bySymbol.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "ko"),
  );

  const body = list
    .map((e) => `  ["${e.symbol}", ${JSON.stringify(e.name)}],`)
    .join("\n");

  const ts = `/**
 * krx-catalog.generated.ts — AUTO-GENERATED. Do not edit by hand.
 *
 *  Full KOSPI + KOSDAQ listing (회사명 + 종목코드) for offline stock search.
 *  Regenerate with:  node scripts/gen-krx-catalog.mjs
 *  Source: KRX KIND 상장법인목록. Total entries: ${list.length}.
 *  Format: [symbol, name] where KOSPI = bare 6-digit, KOSDAQ = "<code>.KQ".
 */

/** [symbol, koreanName] tuples — compact form to keep the bundle small. */
export const KRX_STOCKS: ReadonlyArray<readonly [string, string]> = [
${body}
];
`;

  const outPath = path.join(
    process.cwd(),
    "lib",
    "api",
    "stock",
    "krx-catalog.generated.ts",
  );
  await writeFile(outPath, ts, "utf8");
  console.log(`✓ wrote ${list.length} entries → ${outPath}`);
}

main().catch((e) => {
  console.error("generation failed:", e);
  process.exit(1);
});
