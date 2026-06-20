"use client";

/**
 * favorites · ExpandedView — full link list, grouped (설계서 §2.1 #3).
 *
 *  Renders purely from `config`. Links are bucketed by their optional `group`
 *  (ungrouped links land in a "기타" section, only shown when there are groups).
 *  Adding/editing flows through the ConfigEditor (편집) — a hint points there.
 */

import * as React from "react";
import { ExternalLink } from "lucide-react";
import type { ExpandedViewProps } from "@/lib/widgets/contract";
import { hostnameOf, hrefOf, type FavoriteLink, type FavoritesConfig } from "./types";
import { FaviconImg } from "./FaviconImg";

const UNGROUPED = "기타";

/** Bucket links by group, preserving first-seen group order. */
function groupLinks(links: FavoriteLink[]): { name: string; links: FavoriteLink[] }[] {
  const order: string[] = [];
  const buckets = new Map<string, FavoriteLink[]>();
  for (const link of links) {
    const name = link.group?.trim() || UNGROUPED;
    if (!buckets.has(name)) {
      buckets.set(name, []);
      order.push(name);
    }
    buckets.get(name)!.push(link);
  }
  return order.map((name) => ({ name, links: buckets.get(name)! }));
}

function LinkRow({ link }: { link: FavoriteLink }) {
  const host = hostnameOf(link.url);
  return (
    <li>
      <a
        href={hrefOf(link.url)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 rounded-md border border-border bg-card/60 px-3 py-2 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
      >
        <FaviconImg key={link.url} link={link} size={28} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium text-foreground">
            {link.label || host || link.url}
          </span>
          {host ? (
            <span className="truncate text-xs text-muted-foreground">{host}</span>
          ) : null}
        </span>
        <ExternalLink
          size={15}
          aria-hidden
          className="shrink-0 text-muted-foreground"
        />
      </a>
    </li>
  );
}

export function FavoritesExpandedView({ config }: ExpandedViewProps<FavoritesConfig>) {
  if (config.links.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        즐겨찾기가 없습니다. 위젯 메뉴의 “편집”에서 추가하세요.
      </p>
    );
  }

  const groups = groupLinks(config.links);
  // Only show group headings when more than one bucket exists (avoids a lone "기타").
  const showHeadings = groups.length > 1;

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col gap-5">
      {groups.map((g) => (
        <section key={g.name} className="flex flex-col gap-2">
          {showHeadings ? (
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {g.name}
            </h3>
          ) : null}
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {g.links.map((link) => (
              <LinkRow key={link.id} link={link} />
            ))}
          </ul>
        </section>
      ))}
      <p className="text-xs text-muted-foreground">
        링크 추가·삭제·순서·그룹 변경은 위젯 메뉴의 “편집”에서 할 수 있습니다.
      </p>
    </div>
  );
}

export default FavoritesExpandedView;
