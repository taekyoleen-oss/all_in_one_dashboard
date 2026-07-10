"use client";

/**
 * image-slider · ExpandedView — large viewer + prev/next (설계서 §2.1 #4).
 *
 *  Renders from `config`. Large image with prev/next buttons, dot navigation, and
 *  keyboard ←/→ support. Auto-advances on the configured interval (paused under
 *  prefers-reduced-motion). The interval VALUE is edited in the ConfigEditor (per
 *  the frozen contract, no onChange here) — the current setting is shown with a
 *  pointer there.
 */

import * as React from "react";
import { ChevronLeft, ChevronRight, Download, ImageOff } from "lucide-react";
import type { ExpandedViewProps } from "@/lib/widgets/contract";
import { clampInterval, type ImageSliderConfig } from "./types";
import { useAutoAdvance } from "./useAutoAdvance";
import { downloadSlideImage } from "./imageFiles";

export function ImageSliderExpandedView({
  config,
}: ExpandedViewProps<ImageSliderConfig>) {
  const images = config.images;
  const interval = clampInterval(config.intervalSec);
  const { index, prev, next, goTo, playing } = useAutoAdvance(
    images.length,
    interval,
  );
  const [errored, setErrored] = React.useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      prev();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      next();
    }
  };

  if (images.length === 0) {
    return (
      <div className="flex h-full min-h-[40dvh] flex-col items-center justify-center gap-2 text-muted-foreground">
        <ImageOff size={28} aria-hidden />
        <p className="text-sm">
          이미지가 없습니다. 위젯 메뉴의 “편집”에서 추가하세요.
        </p>
      </div>
    );
  }

  const current = images[index];
  const failed = errored.has(current.id);
  const title = config.title?.trim();

  return (
    <div
      className="mx-auto flex h-full w-full max-w-3xl flex-col gap-3"
      role="group"
      aria-roledescription="이미지 슬라이드"
      aria-label={`${index + 1} / ${images.length}`}
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      {title ? (
        <h2 className="shrink-0 truncate text-center text-lg font-semibold text-foreground">
          {title}
        </h2>
      ) : null}

      {/* 큰 이미지는 폭에 맞추고 세로로 스크롤해 전체 내용을 볼 수 있다(요구). */}
      <div className="relative min-h-[40dvh] max-h-[75dvh] flex-1 overflow-hidden rounded-[var(--radius)] bg-muted">
        {failed ? (
          <div className="flex h-full min-h-[40dvh] w-full items-center justify-center text-muted-foreground">
            <ImageOff size={28} aria-hidden />
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
              alt={current.caption ?? `슬라이드 ${index + 1}`}
              className="mx-auto block h-auto w-full"
              onError={() =>
                setErrored((s) => {
                  const n = new Set(s);
                  n.add(current.id);
                  return n;
                })
              }
            />
          </div>
        )}

        {images.length > 1 ? (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="이전 이미지"
              className="absolute left-2 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white outline-none transition-colors hover:bg-black/60 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="다음 이미지"
              className="absolute right-2 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white outline-none transition-colors hover:bg-black/60 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronRight size={20} />
            </button>
          </>
        ) : null}

        {/* 현재 이미지 다운로드(2026-07-10 사용자 요청) — 파일로 저장 */}
        {!failed ? (
          <button
            type="button"
            onClick={() =>
              void downloadSlideImage(current, `슬라이드-${index + 1}`)
            }
            aria-label="현재 이미지 다운로드"
            title="현재 이미지 다운로드"
            className="absolute right-2 top-2 inline-flex size-9 items-center justify-center rounded-full bg-black/40 text-white outline-none transition-colors hover:bg-black/60 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Download size={18} />
          </button>
        ) : null}
      </div>

      {current.caption ? (
        <p className="text-center text-sm text-foreground">{current.caption}</p>
      ) : null}

      {images.length > 1 ? (
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`${i + 1}번 이미지로 이동`}
              aria-current={i === index}
              className={[
                "size-2.5 rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                i === index ? "bg-primary" : "bg-muted-foreground/40 hover:bg-muted-foreground/70",
              ].join(" ")}
            />
          ))}
        </div>
      ) : null}

      <p className="text-center text-xs text-muted-foreground">
        {index + 1} / {images.length}
        {" · "}
        {interval > 0
          ? `자동 전환 ${interval}초${playing ? "" : " (감소된 모션: 일시정지)"}`
          : "자동 전환 꺼짐"}
        {" · 전환 간격은 “편집”에서 변경"}
      </p>
    </div>
  );
}

export default ImageSliderExpandedView;
