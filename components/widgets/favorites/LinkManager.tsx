"use client";

/**
 * favorites · LinkManager — add / edit / remove / reorder links (설계서 §2.1 #3).
 *
 *  Controlled: reports the whole next config via onChange (parent owns draft +
 *  persistence). Each link edits label + url + optional group. Reorder via
 *  up/down buttons (keyboard-operable). A live favicon preview hints whether the
 *  URL resolves.
 */

import * as React from "react";
import { ArrowUp, ArrowDown, Trash2, Plus } from "lucide-react";
import type { FavoritesConfig, FavoriteLink } from "./types";
import { FaviconImg } from "./FaviconImg";

function newLinkId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `fav-${crypto.randomUUID().slice(0, 6)}`
    : `fav-${Math.random().toString(36).slice(2, 8)}`;
}

export function LinkManager({
  config,
  onChange,
}: {
  config: FavoritesConfig;
  onChange: (next: FavoritesConfig) => void;
}) {
  const setLinks = (links: FavoriteLink[]) => onChange({ ...config, links });

  const patch = (id: string, fields: Partial<FavoriteLink>) =>
    setLinks(config.links.map((l) => (l.id === id ? { ...l, ...fields } : l)));

  const remove = (id: string) => setLinks(config.links.filter((l) => l.id !== id));

  const move = (index: number, dir: -1 | 1) => {
    const next = [...config.links];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setLinks(next);
  };

  const add = () => {
    setLinks([...config.links, { id: newLinkId(), label: "", url: "", group: "" }]);
  };

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {config.links.map((l, i) => (
          <li
            key={l.id}
            className="flex flex-col gap-2 rounded-md border border-border bg-background/40 p-2"
          >
            <div className="flex items-center gap-2">
              <FaviconImg key={l.url} link={l} size={20} />
              <input
                value={l.label}
                onChange={(e) => patch(l.id, { label: e.target.value })}
                placeholder="이름 (예: GitHub)"
                className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <button
                type="button"
                aria-label={`${l.label || "링크"} 위로`}
                disabled={i === 0}
                onClick={() => move(i, -1)}
                className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30"
              >
                <ArrowUp size={15} />
              </button>
              <button
                type="button"
                aria-label={`${l.label || "링크"} 아래로`}
                disabled={i === config.links.length - 1}
                onClick={() => move(i, 1)}
                className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30"
              >
                <ArrowDown size={15} />
              </button>
              <button
                type="button"
                aria-label={`${l.label || "링크"} 삭제`}
                onClick={() => remove(l.id)}
                className="inline-flex size-7 items-center justify-center rounded-md text-destructive outline-none transition-colors hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Trash2 size={15} />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="url"
                inputMode="url"
                value={l.url}
                onChange={(e) => patch(l.id, { url: e.target.value })}
                placeholder="https://example.com"
                className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <input
                value={l.group ?? ""}
                onChange={(e) => patch(l.id, { group: e.target.value })}
                placeholder="그룹 (선택)"
                className="w-28 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </li>
        ))}
        {config.links.length === 0 ? (
          <li className="rounded-md border border-dashed border-border px-2 py-3 text-center text-xs text-muted-foreground">
            추가된 링크가 없습니다.
          </li>
        ) : null}
      </ul>

      <button
        type="button"
        onClick={add}
        className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Plus size={15} aria-hidden />
        링크 추가
      </button>
    </div>
  );
}

export default LinkManager;
