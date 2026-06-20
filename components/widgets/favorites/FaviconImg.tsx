"use client";

/**
 * favorites · FaviconImg — favicon with a letter-avatar fallback.
 *
 *  Tries the public favicon service; on load error (offline, blocked, 404) it
 *  swaps to a colored letter avatar so the grid never shows broken images and
 *  works with no network / no API key. The avatar's letter is a real text glyph,
 *  so the entry is identifiable even when color is unavailable.
 *
 *  Uses a raw <img> (not next/image): the src is an arbitrary user-supplied host
 *  that can't be pre-listed in next.config `remotePatterns`, and we rely on the
 *  native onError event for the fallback. State flips only in an event handler
 *  (onError) — React-19-safe. The caller keys this by url so a URL change remounts
 *  it (fresh failed=false) instead of mutating state during render.
 */

import * as React from "react";
import { avatarLetter, avatarHue, faviconUrl, type FavoriteLink } from "./types";

export function FaviconImg({
  link,
  size = 24,
  rounded = "rounded-md",
}: {
  link: FavoriteLink;
  size?: number;
  rounded?: string;
}) {
  const src = faviconUrl(link.url);
  const [failed, setFailed] = React.useState(false);

  const showFallback = !src || failed;

  if (showFallback) {
    const hue = avatarHue(link);
    return (
      <span
        aria-hidden
        style={{
          width: size,
          height: size,
          backgroundColor: `oklch(0.55 0.12 ${hue})`,
          fontSize: Math.round(size * 0.5),
        }}
        className={[
          "inline-flex shrink-0 items-center justify-center font-semibold leading-none text-white",
          rounded,
        ].join(" ")}
      >
        {avatarLetter(link)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- arbitrary user host; can't be allowlisted in next.config remotePatterns, and we need native onError for the letter-avatar fallback.
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      className={["shrink-0 object-contain", rounded].join(" ")}
    />
  );
}

export default FaviconImg;
