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
  /**
   * 사용자가 직접 지정한 인스턴스 제목(선택). 비어 있으면 헤더 제목은 검색어에서
   * 파생된다 — `newsInstanceTitle` 참고. 제목 변경(더블클릭)을 하면 여기에 저장돼
   * 검색어를 바꿔도 유지된다.
   */
  title?: string;
}

/**
 * 헤더/전체보기에 보일 이름 — 설정한 검색어가 드러나게 "뉴스 (보험 검색)" 형태.
 * 사용자가 제목을 직접 바꿨으면 그것을 우선한다. 둘 다 비면 null(=displayName "뉴스").
 */
export function newsInstanceTitle(config: NewsConfig): string | null {
  const custom = config.title?.trim();
  if (custom) return custom;
  const q = config.query?.trim();
  return q ? `뉴스 (${q} 검색)` : null;
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
