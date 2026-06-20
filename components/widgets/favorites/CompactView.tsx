"use client";

/**
 * favorites · CompactView — favicon/letter grid of quick links (설계서 §2.1 #3).
 *
 *  Renders purely from `config`. Each tile is a real <a> (keyboard-focusable,
 *  opens in a new tab) with a favicon that falls back to a letter avatar offline.
 *  The label sits under the icon, so the link is identifiable without the favicon.
 */

import * as React from "react";
import type { CompactViewProps } from "@/lib/widgets/contract";
import { hrefOf, type FavoritesConfig } from "./types";
import { FaviconImg } from "./FaviconImg";

export function FavoritesCompactView({
  config,
  density,
}: CompactViewProps<FavoritesConfig>) {
  if (config.links.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        즐겨찾기가 없습니다. 편집에서 추가하세요.
      </p>
    );
  }

  const iconSize = density === "compact" ? 20 : 24;

  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(56px,1fr))] gap-2 @[260px]/widget:grid-cols-[repeat(auto-fill,minmax(64px,1fr))]">
      {config.links.map((link) => (
        <li key={link.id} className="min-w-0">
          <a
            href={hrefOf(link.url)}
            target="_blank"
            rel="noopener noreferrer"
            title={link.label || link.url}
            className="flex flex-col items-center gap-1 rounded-md p-1.5 text-center outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          >
            <FaviconImg key={link.url} link={link} size={iconSize} />
            <span className="w-full truncate text-[11px] text-foreground">
              {link.label || link.url}
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export default FavoritesCompactView;
