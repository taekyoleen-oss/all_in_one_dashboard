"use client";

/**
 * favorites · CompactView — favicon/letter grid of quick links (설계서 §2.1 #3).
 *
 *  Renders from `config`. Each tile is a real <a> (new tab) with a favicon that
 *  falls back to a letter avatar offline. 타일 하단 QuickAdd로 링크를 바로 추가한다.
 */

import * as React from "react";
import type { CompactViewProps } from "@/lib/widgets/contract";
import { useSaveWidgetConfig } from "@/lib/widgets/persistence";
import {
  QuickAdd,
  newItemId,
  quickInputClass,
  quickBtnClass,
} from "@/components/widgets/shared/QuickAdd";
import { hrefOf, type FavoritesConfig } from "./types";
import { FaviconImg } from "./FaviconImg";

export function FavoritesCompactView({
  config,
  instanceId,
  density,
}: CompactViewProps<FavoritesConfig>) {
  const iconSize = density === "compact" ? 20 : 24;

  return (
    <div className="flex h-full w-full flex-col gap-2">
      {config.links.length === 0 ? (
        <p className="text-sm text-muted-foreground">즐겨찾기가 없습니다.</p>
      ) : (
        <ul className="grid min-h-0 flex-1 grid-cols-[repeat(auto-fill,minmax(56px,1fr))] content-start gap-2 overflow-y-auto pb-scroll @[260px]/widget:grid-cols-[repeat(auto-fill,minmax(64px,1fr))]">
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
      )}

      <FavoritesQuickAdd config={config} instanceId={instanceId} />
    </div>
  );
}

/** 타일 하단 빠른 추가: URL(필수) + 이름(선택). */
function FavoritesQuickAdd({
  config,
  instanceId,
}: {
  config: FavoritesConfig;
  instanceId: string;
}) {
  const save = useSaveWidgetConfig();
  const [url, setUrl] = React.useState("");
  const [label, setLabel] = React.useState("");
  const add = () => {
    const u = url.trim();
    if (!u) return;
    save(instanceId, {
      ...config,
      links: [
        ...config.links,
        { id: newItemId("f"), label: label.trim(), url: u, group: "" },
      ],
    });
    setUrl("");
    setLabel("");
  };
  return (
    <QuickAdd label="링크 추가">
      {() => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
          className="flex flex-col gap-1.5"
        >
          <input
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="URL (예: github.com)"
            className={`${quickInputClass} w-full`}
          />
          <div className="flex items-center gap-1.5">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="이름 (선택)"
              className={`${quickInputClass} flex-1`}
            />
            <button type="submit" disabled={!url.trim()} className={quickBtnClass}>
              추가
            </button>
          </div>
        </form>
      )}
    </QuickAdd>
  );
}

export default FavoritesCompactView;
