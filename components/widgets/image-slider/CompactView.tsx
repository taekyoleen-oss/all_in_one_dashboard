"use client";

/**
 * image-slider · CompactView — auto-advancing thumbnail (설계서 §2.1 #4).
 *
 *  Renders from `config`. Cycles slides on the configured interval (paused under
 *  prefers-reduced-motion). Tiny dot indicators show position (count + active dot
 *  is not color-only — it's also a size/opacity change). Storage is deferred; the
 *  src is a user-supplied URL, so a raw <img> with onError → placeholder is used.
 */

import * as React from "react";
import { ImageOff } from "lucide-react";
import type { CompactViewProps } from "@/lib/widgets/contract";
import { clampInterval, type ImageSliderConfig } from "./types";
import { useAutoAdvance } from "./useAutoAdvance";

export function ImageSliderCompactView({ config }: CompactViewProps<ImageSliderConfig>) {
  const images = config.images;
  const interval = clampInterval(config.intervalSec);
  const { index } = useAutoAdvance(images.length, interval);
  const [errored, setErrored] = React.useState<ReadonlySet<string>>(
    () => new Set(),
  );

  if (images.length === 0) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
        <ImageOff size={20} aria-hidden />
        <p className="text-xs">이미지가 없습니다. 편집에서 추가하세요.</p>
      </div>
    );
  }

  const current = images[index];
  const failed = errored.has(current.id);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-md bg-muted">
      {failed ? (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          <ImageOff size={20} aria-hidden />
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- user-supplied URL (Storage upload deferred); can't be allowlisted in next.config, and onError drives the placeholder.
        <img
          key={current.id}
          src={current.url}
          alt={current.caption ?? ""}
          loading="lazy"
          onError={() =>
            setErrored((prev) => {
              const n = new Set(prev);
              n.add(current.id);
              return n;
            })
          }
          className="h-full w-full object-cover"
        />
      )}

      {images.length > 1 ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-1 flex items-center justify-center gap-1">
          {images.map((img, i) => (
            <span
              key={img.id}
              aria-hidden
              className={[
                "rounded-full bg-white transition-all",
                i === index ? "size-1.5 opacity-90" : "size-1 opacity-50",
              ].join(" ")}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default ImageSliderCompactView;
