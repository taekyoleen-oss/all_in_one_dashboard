"use client";

/**
 * image-slider · CompactView — auto-advancing thumbnail (설계서 §2.1 #4).
 *
 *  Renders from `config`. Cycles slides on the configured interval (paused under
 *  prefers-reduced-motion). Tiny dot indicators show position (count + active dot
 *  is not color-only — it's also a size/opacity change). Storage is deferred; the
 *  src is a user-supplied URL, so a raw <img> with onError → placeholder is used.
 *
 *  타일에서 바로 추가·저장(2026-07-10 사용자 요청):
 *   • 빈 상태(이미지 0장)를 클릭하면 파일 선택이 바로 열려 편집 없이 추가된다.
 *   • 이미지가 있으면 우상단 호버 오버레이로 [추가]·[다운로드] 버튼 제공 —
 *     다운로드는 현재 표시 중인 슬라이드를 파일로 저장한다.
 *  두 경로 모두 편집 다이얼로그와 같은 파이프라인(filesToSlides)으로 축소 저장.
 */

import * as React from "react";
import { Download, ImageOff, ImagePlus, Loader2 } from "lucide-react";
import type { CompactViewProps } from "@/lib/widgets/contract";
import { useSaveWidgetConfig } from "@/lib/widgets/persistence";
import { clampInterval, type ImageSliderConfig } from "./types";
import { useAutoAdvance } from "./useAutoAdvance";
import { downloadSlideImage, filesToSlides, limitMessage } from "./imageFiles";

export function ImageSliderCompactView({
  config,
  instanceId,
}: CompactViewProps<ImageSliderConfig>) {
  const images = config.images;
  const interval = clampInterval(config.intervalSec);
  const { index } = useAutoAdvance(images.length, interval);
  const [errored, setErrored] = React.useState<ReadonlySet<string>>(
    () => new Set(),
  );

  // 타일에서 바로 추가 — 편집과 동일 파이프라인으로 config에 영속.
  const save = useSaveWidgetConfig();
  const fileRef = React.useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [limitMsg, setLimitMsg] = React.useState<string | null>(null);
  const addFiles = async (files: FileList | null) => {
    setBusy(true);
    setLimitMsg(null);
    try {
      const { added, skipped } = await filesToSlides(files, config.images);
      if (skipped > 0) setLimitMsg(limitMessage(skipped));
      if (added.length > 0)
        save(instanceId, {
          ...config,
          images: [...config.images, ...added],
        } satisfies ImageSliderConfig);
    } finally {
      setBusy(false);
    }
  };

  const fileInput = (
    <input
      ref={fileRef}
      type="file"
      accept="image/*"
      multiple
      className="hidden"
      onChange={(e) => {
        void addFiles(e.target.files);
        e.target.value = ""; // allow re-picking the same file
      }}
    />
  );

  if (images.length === 0) {
    // 빈 공간 자체가 "추가" 버튼 — 클릭 시 파일 선택이 바로 열린다.
    return (
      <button
        type="button"
        data-pb-no-drag=""
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className="flex h-full w-full flex-col items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-border text-muted-foreground outline-none transition-colors hover:border-primary hover:bg-primary/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none"
      >
        {busy ? (
          <Loader2 size={20} className="animate-spin" aria-hidden />
        ) : (
          <ImagePlus size={20} aria-hidden />
        )}
        <p className="text-xs">
          {busy ? "이미지 처리 중…" : "눌러서 이미지 추가"}
        </p>
        {limitMsg ? (
          <p role="status" className="px-2 text-[11px] text-destructive">
            {limitMsg}
          </p>
        ) : null}
        {fileInput}
      </button>
    );
  }

  const current = images[index];
  const failed = errored.has(current.id);
  const title = config.title?.trim();

  return (
    <div className="group/slider flex h-full w-full flex-col overflow-hidden rounded-md bg-muted">
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

        {/* 우상단 오버레이 — 추가·다운로드. 데스크톱은 호버 시, 터치는 상시 노출. */}
        <div className="absolute right-1 top-1 flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover/slider:opacity-100 pointer-coarse:opacity-100">
          <button
            type="button"
            data-pb-no-drag=""
            aria-label="이미지 추가"
            title="이미지 추가"
            disabled={busy}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => fileRef.current?.click()}
            className="inline-flex size-7 items-center justify-center rounded-md bg-black/45 text-white outline-none transition-colors hover:bg-black/65 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {busy ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <ImagePlus size={14} />
            )}
          </button>
          <button
            type="button"
            data-pb-no-drag=""
            aria-label="현재 이미지 다운로드"
            title="현재 이미지 다운로드"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() =>
              void downloadSlideImage(current, `슬라이드-${index + 1}`)
            }
            className="inline-flex size-7 items-center justify-center rounded-md bg-black/45 text-white outline-none transition-colors hover:bg-black/65 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Download size={14} />
          </button>
        </div>

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
      {fileInput}
    </div>
  );
}

export default ImageSliderCompactView;
