/**
 * ============================================================================
 *  News client — Naver primary + keyless Google News RSS fallback (설계서 §2.2)
 * ============================================================================
 *
 *  SERVER-ONLY. Normalizes headlines into the shared `NewsList` shape
 *  (output/api-shapes.ts — the anti-drift single source).
 *
 *    • PRIMARY  : Naver News API (needs NAVER_CLIENT_ID / NAVER_CLIENT_SECRET).
 *      Used only when BOTH are present.
 *    • FALLBACK : a **keyless** public Google News RSS for the same keyword,
 *      parsed server-side — works today with no key.
 *
 *  HTML tags/entities in titles & summaries are stripped server-side so the
 *  widget renders plain text. The route caches (short TTL) and never throws raw
 *  upstream errors to the client.
 * ============================================================================
 */

// SERVER-ONLY: imported only from app/api/news/route.ts. NAVER_CLIENT_ID/SECRET
// (when present) are read here and never serialized to the client.
import type { NewsItem, NewsList } from "@/output/api-shapes";

const FETCH_TIMEOUT_MS = 8_000;
const MAX_ITEMS = 20;

export const DEFAULT_NEWS_QUERY = "속보";

/** True iff both Naver credentials are present + non-empty. */
export function hasNaverCreds(): boolean {
  return Boolean(
    process.env.NAVER_CLIENT_ID?.trim() && process.env.NAVER_CLIENT_SECRET?.trim(),
  );
}

/* ---------------------------------------------------------------------------
 *  text helpers — strip HTML, decode common entities, parse dates
 * ------------------------------------------------------------------------- */

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

/** Remove tags, decode a handful of entities, collapse whitespace. */
export function stripHtml(input: string): string {
  const noTags = input.replace(/<[^>]*>/g, " ");
  const decoded = noTags.replace(/&[a-zA-Z]+;|&#\d+;/g, (m) => {
    if (ENTITIES[m]) return ENTITIES[m];
    const num = /^&#(\d+);$/.exec(m);
    if (num) {
      const code = Number(num[1]);
      return Number.isFinite(code) ? String.fromCodePoint(code) : " ";
    }
    return " ";
  });
  return decoded.replace(/\s+/g, " ").trim();
}

/** Parse an RFC-822 / ISO date string to epoch ms, or null. */
function parseDate(raw: string | undefined): number | null {
  if (!raw) return null;
  const ts = Date.parse(raw);
  return Number.isNaN(ts) ? null : ts;
}

/* ---------------------------------------------------------------------------
 *  Naver News API (primary, keyed)
 * ------------------------------------------------------------------------- */

const NAVER_BASE = "https://openapi.naver.com/v1/search/news.json";

interface NaverNewsItem {
  title?: string;
  originallink?: string;
  link?: string;
  description?: string;
  pubDate?: string;
}
interface NaverNewsResponse {
  items?: NaverNewsItem[];
}

async function fetchNaver(query: string): Promise<NewsList | null> {
  const id = process.env.NAVER_CLIENT_ID?.trim();
  const secret = process.env.NAVER_CLIENT_SECRET?.trim();
  if (!id || !secret) return null;

  const url = `${NAVER_BASE}?query=${encodeURIComponent(query)}&display=${MAX_ITEMS}&sort=date`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "X-Naver-Client-Id": id,
        "X-Naver-Client-Secret": secret,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as NaverNewsResponse;
    if (!Array.isArray(json.items)) return null;

    const items: NewsItem[] = [];
    for (const it of json.items) {
      const link = (it.originallink || it.link || "").trim();
      const title = stripHtml(it.title ?? "");
      if (!link || !title) continue;
      items.push({
        title,
        link,
        source: sourceFromUrl(link),
        publishedAt: parseDate(it.pubDate),
        summary: it.description ? stripHtml(it.description) : undefined,
      });
      if (items.length >= MAX_ITEMS) break;
    }
    if (items.length === 0) return null;

    return { query, items, provider: "naver", stale: false, ts: Date.now() };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* ---------------------------------------------------------------------------
 *  Google News RSS (keyless fallback)
 * ------------------------------------------------------------------------- */

function googleNewsRssUrl(query: string): string {
  // Korean edition; hl/gl/ceid scope it to ko-KR.
  const q = encodeURIComponent(query);
  return `https://news.google.com/rss/search?q=${q}&hl=ko&gl=KR&ceid=KR:ko`;
}

/** Extract the inner text of the FIRST <tag>…</tag> in `xml` (CDATA-aware). */
function tagText(xml: string, tag: string): string | undefined {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i");
  const m = re.exec(xml);
  if (!m) return undefined;
  let v = m[1];
  const cdata = /^<!\[CDATA\[([\s\S]*?)\]\]>$/.exec(v.trim());
  if (cdata) v = cdata[1];
  return v;
}

/**
 * Parse a Google News RSS feed into headlines, without an XML dependency:
 * split on <item> boundaries and pull title/link/pubDate/description/source.
 */
function parseRss(xml: string, query: string): NewsList | null {
  const items: NewsItem[] = [];
  const itemRe = /<item\b[\s\S]*?<\/item>/gi;
  const matches = xml.match(itemRe) ?? [];
  for (const block of matches) {
    const rawTitle = tagText(block, "title");
    const rawLink = tagText(block, "link");
    if (!rawTitle || !rawLink) continue;
    const title = stripHtml(rawTitle);
    const link = stripHtml(rawLink);
    if (!title || !/^https?:\/\//i.test(link)) continue;

    // Google News encodes the publisher in <source ...>name</source>.
    const source = tagText(block, "source");
    const descr = tagText(block, "description");

    items.push({
      title,
      link,
      source: source ? stripHtml(source) : sourceFromUrl(link),
      publishedAt: parseDate(tagText(block, "pubDate")),
      summary: descr ? stripHtml(descr) : undefined,
    });
    if (items.length >= MAX_ITEMS) break;
  }
  if (items.length === 0) return null;
  return { query, items, provider: "rss", stale: true, ts: Date.now() };
}

async function fetchRss(query: string): Promise<NewsList | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(googleNewsRssUrl(query), {
      signal: controller.signal,
      headers: {
        Accept: "application/rss+xml, application/xml, text/xml",
        "User-Agent": "Mozilla/5.0 (PaneBoard news fallback)",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const xml = await res.text();
    return parseRss(xml, query);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* ---------------------------------------------------------------------------
 *  helpers + public entry
 * ------------------------------------------------------------------------- */

/** Best-effort publisher label from a URL host (e.g. "yna.co.kr" → "yna.co.kr"). */
function sourceFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Normalize a free-text query (trim; default when empty). */
export function normalizeQuery(raw: string | null): string {
  const q = (raw ?? "").trim();
  return q.length > 0 ? q : DEFAULT_NEWS_QUERY;
}

/** Try Naver (if keyed) → keyless Google News RSS → null. */
export async function fetchNews(query: string): Promise<NewsList | null> {
  if (hasNaverCreds()) {
    const naver = await fetchNaver(query);
    if (naver) return naver;
  }
  return fetchRss(query);
}
