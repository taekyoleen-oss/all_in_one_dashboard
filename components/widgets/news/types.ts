/**
 * news widget — config shape (설계서 §2.2 "뉴스/RSS").
 *
 *  The widget stores ONE search keyword (a category is just a preset keyword).
 *  Headline DATA never lives in config — only the keyword does; live headlines
 *  arrive from /api/news (?query=). dataMode:'poll'.
 *
 *  Default keyword = "속보" (mirrors the route's DEFAULT_NEWS_QUERY) so a fresh
 *  widget renders without any setup.
 */

export interface NewsConfig {
  /** Free-text search keyword for headlines (e.g. "속보", "AI", "경제"). */
  query: string;
}

/** Default keyword (mirrors the /api/news DEFAULT_NEWS_QUERY). */
export const DEFAULT_NEWS_CONFIG: NewsConfig = {
  query: "속보",
};

/** Quick category presets — each is just a preset keyword for the picker. */
export const NEWS_CATEGORIES: { keyword: string; label: string }[] = [
  { keyword: "속보", label: "속보" },
  { keyword: "경제", label: "경제" },
  { keyword: "정치", label: "정치" },
  { keyword: "IT", label: "IT/과학" },
  { keyword: "스포츠", label: "스포츠" },
  { keyword: "연예", label: "연예" },
  { keyword: "세계", label: "세계" },
  { keyword: "AI", label: "AI" },
];
