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
import { ArrowUp, ArrowDown, Trash2, Plus, ClipboardPaste } from "lucide-react";
import { hostnameOf, type FavoritesConfig, type FavoriteLink } from "./types";
import { FaviconImg } from "./FaviconImg";

function newLinkId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `fav-${crypto.randomUUID().slice(0, 6)}`
    : `fav-${Math.random().toString(36).slice(2, 8)}`;
}

/** A pasted token is a link if it has an explicit scheme or a dotted host. */
function looksLikeUrl(token: string): boolean {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(token)) return true;
  return hostnameOf(token).includes(".");
}

/** Pull link-like tokens out of pasted text (handles one or several, multiline). */
function extractUrls(text: string): string[] {
  return text
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && looksLikeUrl(t));
}

/** Friendly default label from a URL's second-level domain ("github.com" → "Github"). */
function labelFromUrl(rawUrl: string): string {
  const host = hostnameOf(rawUrl).replace(/^www\./, "");
  if (!host) return "";
  const parts = host.split(".");
  const sld = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
  return sld ? sld.charAt(0).toUpperCase() + sld.slice(1) : "";
}

export function LinkManager({
  config,
  onChange,
}: {
  config: FavoritesConfig;
  onChange: (next: FavoritesConfig) => void;
}) {
  const [notice, setNotice] = React.useState<string | null>(null);

  const setLinks = (links: FavoriteLink[]) => onChange({ ...config, links });

  /** Append link(s) from pasted URLs, auto-labeling each by domain. */
  const addUrls = (urls: string[]) => {
    if (urls.length === 0) return;
    const added: FavoriteLink[] = urls.map((u) => ({
      id: newLinkId(),
      label: labelFromUrl(u),
      url: u,
      group: "",
    }));
    setLinks([...config.links, ...added]);
    setNotice(`${added.length}개 링크를 추가했습니다.`);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData?.getData("text") ?? "";
    const urls = extractUrls(text);
    if (urls.length === 0) return;
    e.preventDefault();
    addUrls(urls);
  };

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

      {/* 붙여넣기로 추가 — focus here and Ctrl/⌘+V a copied link (or several). */}
      <div
        onPaste={handlePaste}
        tabIndex={0}
        role="group"
        aria-label="링크 붙여넣기로 추가"
        className="flex flex-col items-center gap-2 rounded-md border-2 border-dashed border-border px-3 py-4 text-center outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ClipboardPaste size={18} className="text-muted-foreground" aria-hidden />
        <p className="text-xs text-muted-foreground">
          여기를 클릭한 뒤 복사한 링크를 붙여넣기(Ctrl/⌘+V)하면 즐겨찾기에 추가됩니다.
        </p>
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus size={15} aria-hidden />
          링크 직접 추가
        </button>
        {notice ? (
          <p className="text-[11px] text-muted-foreground">{notice}</p>
        ) : null}
      </div>
    </div>
  );
}

export default LinkManager;
