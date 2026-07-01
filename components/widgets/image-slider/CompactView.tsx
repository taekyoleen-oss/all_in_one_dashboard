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
  const title = config.title?.trim();

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-md bg-muted">
      {title ? (
        <p className="shrink-0 truncate bg-background/60 px-2 py-1 text-center text-xs font-medium text-foreground">
          {title}
        </p>
      ) : null}

      {/* 이미지 영역: 큰 이미지는 폭에 맞추고 세로로 스크롤해 전체를 볼 수 있다(요구). */}
      <div className="relative min-h-0 flex-1">
        {failed ? (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <ImageOff size={20} aria-hidden />
          </div>
        ) : (
          <div
            data-pb-no-drag=""
            className="h-full w-full overflow-y-auto pb-scroll"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- user-supplied URL (Storage upload deferred); can't be allowlisted in next.config, and onError drives the placeholder. */}
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
              className="block h-auto w-full"
            />
          </div>
        )}

        {images.length > 1 ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-1 flex items-center justify-center gap-1">
            {images.map((img, i) => (
              <span
                key={img.id}
                aria-hidden
                className={[
                  "rounded-full bg-white shadow transition-all",
                  i === index ? "size-1.5 opacity-90" : "size-1 opacity-50",
                ].join(" ")}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default ImageSliderCompactView;
