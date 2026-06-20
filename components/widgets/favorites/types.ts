/**
 * favorites widget — config shape (설계서 §2.1 #3: 즐겨찾기 링크 그리드/그룹).
 *
 *  Links live in `config` (JSON-serializable). Favicons are fetched from a public
 *  favicon service by domain, with a letter-avatar fallback (onError) so the
 *  widget degrades gracefully with no network and needs no API key. dataMode:
 *  'static'. copyBehavior: 'config'.
 */
export interface FavoriteLink {
  /** Stable id (list keys + reorder). */
  id: string;
  /** Display label, e.g. "GitHub". */
  label: string;
  /** Destination URL (http/https). */
  url: string;
  /** Optional group name for the expanded list (empty ⇒ ungrouped). */
  group?: string;
}

export interface FavoritesConfig {
  links: FavoriteLink[];
}

export const DEFAULT_FAVORITES_CONFIG: FavoritesConfig = {
  links: [
    { id: "f1", label: "GitHub", url: "https://github.com", group: "개발" },
    { id: "f2", label: "Google", url: "https://google.com", group: "" },
  ],
};

/** Extract the hostname for the favicon service; "" when the URL is unparseable. */
export function hostnameOf(rawUrl: string): string {
  const url = rawUrl.trim();
  if (!url) return "";
  try {
    // Accept bare domains like "github.com" by defaulting the scheme.
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`;
    return new URL(withScheme).hostname;
  } catch {
    return "";
  }
}

/**
 * Public favicon URL for a domain (DuckDuckGo ip3 service — no API key, no
 * tracking cookie). Returns "" when there is no host (caller shows the letter
 * avatar instead).
 */
export function faviconUrl(rawUrl: string): string {
  const host = hostnameOf(rawUrl);
  return host ? `https://icons.duckduckgo.com/ip3/${host}.ico` : "";
}

/** A normalized href that always carries a scheme (so bare domains still link). */
export function hrefOf(rawUrl: string): string {
  const url = rawUrl.trim();
  if (!url) return "#";
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`;
}

/** First letter for the fallback avatar (label first, else domain, else "?"). */
export function avatarLetter(link: FavoriteLink): string {
  const src = link.label.trim() || hostnameOf(link.url) || "?";
  return src.charAt(0).toUpperCase();
}

/** Deterministic accent hue for a link's letter avatar (stable per label+url). */
export function avatarHue(link: FavoriteLink): number {
  const key = `${link.label}|${link.url}`;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 360;
  return h;
}
