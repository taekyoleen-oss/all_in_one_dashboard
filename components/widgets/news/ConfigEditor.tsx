"use client";

/**
 * news · ConfigEditor — set the search keyword (설계서 §2.2).
 *
 *  Controlled: reports the whole next config via onChange (the dialog owns the
 *  draft; the parent owns persistence). Two ways to set the keyword:
 *    1. 카테고리 — quick preset chips (each is just a preset keyword).
 *    2. 직접 입력 — type any free-text keyword.
 *  No headline DATA is stored — only the keyword (live headlines arrive from
 *  /api/news).
 */

import * as React from "react";
import type { ConfigEditorProps } from "@/lib/widgets/contract";
import { NEWS_CATEGORIES, type NewsConfig } from "./types";

export function NewsConfigEditor({ config, onChange }: ConfigEditorProps<NewsConfig>) {
  const [queryInput, setQueryInput] = React.useState(config.query);

  const apply = (raw: string) => {
    const query = raw.trim();
    if (!query) return;
    onChange({ ...config, query });
  };

  const pickCategory = (keyword: string) => {
    setQueryInput(keyword);
    onChange({ ...config, query: keyword });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Category presets */}
      <fieldset className="flex flex-col gap-2 rounded-md border border-border p-3">
        <legend className="px-1 text-xs font-medium text-muted-foreground">
          카테고리
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {NEWS_CATEGORIES.map((c) => {
            const active = config.query.trim() === c.keyword;
            return (
              <button
                key={c.keyword}
                type="button"
                aria-pressed={active}
                onClick={() => pickCategory(c.keyword)}
                className={[
                  "rounded-full border px-3 py-1 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-foreground hover:bg-accent/40",
                ].join(" ")}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Free-text keyword */}
      <fieldset className="flex flex-col gap-2 rounded-md border border-border p-3">
        <legend className="px-1 text-xs font-medium text-muted-foreground">
          직접 입력
        </legend>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          검색어
          <input
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                apply(queryInput);
              }
            }}
            placeholder="예: 인공지능, 환율, 날씨"
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <button
          type="button"
          onClick={() => apply(queryInput)}
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
        >
          검색어 적용
        </button>
      </fieldset>
    </div>
  );
}

export default NewsConfigEditor;
