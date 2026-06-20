"use client";

/**
 * useNews — poll /api/news for one keyword (설계서 §2.2, dataMode:'poll').
 *
 *  Builds the request URL from THIS instance's config (query), so two news
 *  widgets with different keywords poll independently (격리). The payload is
 *  validated against NewsListSchema — types are IMPORTED from output/api-shapes.ts
 *  (NewsList), never re-declared. A 5-minute cadence matches the route's cache
 *  TTL: fresh enough for a headline tile without hammering the upstream.
 */

import { NewsListSchema } from "@/output/api-shapes";
import { usePoll, type PollState } from "@/components/widgets/shared/usePoll";
import { DEFAULT_NEWS_CONFIG, type NewsConfig } from "./types";

/** Poll cadence for news (headlines refresh on the order of minutes). */
export const NEWS_REFRESH_MS = 300_000;

export type NewsState = PollState<typeof NewsListSchema._output>;

export function useNews(config: NewsConfig): NewsState {
  const query = config.query.trim() || DEFAULT_NEWS_CONFIG.query;
  const url = `/api/news?query=${encodeURIComponent(query)}`;

  return usePoll(url, NewsListSchema, { intervalMs: NEWS_REFRESH_MS });
}

export default useNews;
