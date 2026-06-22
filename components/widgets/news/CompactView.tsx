"use client";

/**
 * news · CompactView — recent headlines on the canvas tile (설계서 §2.2).
 *
 *  Polls /api/news via useNews (keyless Google News RSS fallback works today).
 *  Shows the keyword + a compact list of headlines, each a link opening in a new
 *  tab. Reflows by @container width; the keyword comes from this instance's
 *  config (격리).
 */

import * as React from "react";
import type { CompactViewProps } from "@/lib/widgets/contract";
import { useNews } from "./useNews";
import { relativeTime } from "./format";
import type { NewsConfig } from "./types";

export function NewsCompactView({ config }: CompactViewProps<NewsConfig>) {
  const { data, loading, error } = useNews(config);

  if (loading && !data) {
    return <p className="text-sm text-muted-foreground">뉴스 불러오는 중…</p>;
  }
  if ((error && !data) || !data) {
    return (
      <p className="text-sm text-muted-foreground">뉴스를 불러오지 못했습니다.</p>
    );
  }
  if (data.items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        “{data.query}” 관련 기사가 없습니다.
      </p>
    );
  }

  return (
    <div className="flex h-full flex-col gap-1">
      <p className="shrink-0 truncate text-xs text-muted-foreground">
        “{data.query}”
      </p>
      <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pb-scroll">
        {data.items.map((item, i) => {
          const when = relativeTime(item.publishedAt);
          return (
            <li key={`${item.link}-${i}`} className="min-w-0">
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                title={item.title}
                className="block truncate rounded px-1 py-0.5 text-sm text-foreground outline-none transition-colors hover:bg-accent/40 hover:underline focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="text-muted-foreground">·</span> {item.title}
                {when ? (
                  <span className="ml-1 text-[10px] text-muted-foreground">
                    {when}
                  </span>
                ) : null}
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default NewsCompactView;
