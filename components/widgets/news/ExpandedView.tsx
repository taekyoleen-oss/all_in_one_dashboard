"use client";

/**
 * news · ExpandedView — full headline list with summaries (설계서 §2.2).
 *
 *  Same poll subscription as compact, rendered larger: each item is a link
 *  (opening in a new tab) with its source, relative time, and a short summary.
 *  A header shows the keyword + a manual refresh; the keyword is managed in the
 *  ConfigEditor (편집), not here.
 */

import * as React from "react";
import { ExternalLink } from "lucide-react";
import type { ExpandedViewProps } from "@/lib/widgets/contract";
import { useNews } from "./useNews";
import { relativeTime } from "./format";
import type { NewsConfig } from "./types";

function formatTime(ts: number | null): string {
  if (ts === null) return "—";
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NewsExpandedView({ config }: ExpandedViewProps<NewsConfig>) {
  const { data, loading, error, lastUpdated, refresh } = useNews(config);

  if (loading && !data) {
    return <p className="text-sm text-muted-foreground">뉴스 불러오는 중…</p>;
  }
  if ((error && !data) || !data) {
    return (
      <p className="text-sm text-muted-foreground">뉴스를 불러오지 못했습니다.</p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="truncate">검색어: “{data.query}”</span>
        <button
          type="button"
          onClick={refresh}
          className="shrink-0 rounded-full border border-border px-2 py-0.5 text-foreground outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring"
        >
          새로고침
        </button>
      </div>

      {data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          “{data.query}” 관련 기사가 없습니다.
        </p>
      ) : (
        <ul className="flex flex-col gap-1 rounded-[var(--radius)] border border-border bg-card/40 p-2">
          {data.items.map((item, i) => {
            const when = relativeTime(item.publishedAt);
            return (
              <li key={`${item.link}-${i}`}>
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col gap-0.5 rounded-md px-2 py-1.5 outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="flex items-start gap-1.5 text-sm font-medium text-foreground">
                    <span className="min-w-0 flex-1 group-hover:underline">
                      {item.title}
                    </span>
                    <ExternalLink
                      size={13}
                      aria-hidden
                      className="mt-0.5 shrink-0 text-muted-foreground"
                    />
                  </span>
                  {item.summary ? (
                    <span className="line-clamp-2 text-xs text-muted-foreground">
                      {item.summary}
                    </span>
                  ) : null}
                  <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    {item.source ? <span className="truncate">{item.source}</span> : null}
                    {item.source && when ? <span aria-hidden>·</span> : null}
                    {when ? <span>{when}</span> : null}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}

      {/* Source / updated line */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{data.provider === "naver" ? "네이버 뉴스" : "Google News RSS"}</span>
        <span>갱신: {formatTime(lastUpdated)}</span>
      </div>
    </div>
  );
}

export default NewsExpandedView;
