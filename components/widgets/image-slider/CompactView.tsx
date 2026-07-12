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
 *
 *  이미지 이동 + 마지막 본 화면 유지(2026-07-12 사용자 요청):
 *   • 마우스/펜 드래그로 이미지를 패닝(스크롤 이동)할 수 있다 — 터치는 네이티브
 *     스크롤이 이미 같은 역할. [data-pb-no-drag] 컨테이너라 그리드 드래그와 안 겹침.
 *   • 마지막 본 슬라이드·패닝 위치를 인스턴스별 localStorage(useSlideView)에 저장,
 *     새로고침·재방문 시 같은 화면으로 복원한다.
 */

import * as React from "react";
import { Download, ImageOff, ImagePlus, Loader2 } from "lucide-react";
import type { CompactViewProps } from "@/lib/widgets/contract";
import { useSaveWidgetConfig } from "@/lib/widgets/persistence";
import { clampInterval, type ImageSliderConfig } from "./types";
import { useAutoAdvance } from "./useAutoAdvance";
import { downloadSlideImage, filesToSlides, limitMessage } from "./imageFiles";
import { readSlideView, writeSlideView } from "./useSlideView";

export function ImageSliderCompactView({
  config,
  instanceId,
}: CompactViewProps<ImageSliderConfig>) {
  const images = config.images;
  const interval = clampInterval(config.intervalSec);
  const { index, goTo } = useAutoAdvance(images.length, interval);
  const [errored, setErrored] = React.useState<ReadonlySet<string>>(
    () => new Set(),
  );

  // ── 마지막 본 화면 복원/저장 (localStorage, 인스턴스별) ──────────────────
  const scrollBoxRef = React.useRef<HTMLDivElement | null>(null);
  // 복원 대기 스크롤 오프셋 — 대상 슬라이드 이미지가 로드된 뒤 1회 적용(높이 필요).
  const restoreRef = React.useRef<{
    index: number;
    top: number;
    left: number;
  } | null>(null);
  const restoredRef = React.useRef(false);

  /** img onLoad·복원 effect에서 호출 — 복원 대상 슬라이드가 로드됐을 때만 적용. */
  const applyRestoredScroll = (loadedIndex: number) => {
    const el = scrollBoxRef.current;
    const pending = restoreRef.current;
    if (!el || !pending || pending.index !== loadedIndex) return;
    // 이미지가 아직 높이를 안 가졌으면(로드 전) pending을 소모하지 않는다 —
    // 이후 onLoad가 다시 시도한다. 오프셋 0 복원은 스크롤 불가여도 무해.
    const scrollable =
      el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth;
    if (!scrollable && (pending.top > 0 || pending.left > 0)) return;
    restoreRef.current = null;
    el.scrollTop = pending.top;
    el.scrollLeft = pending.left;
  };

  React.useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const v = readSlideView(instanceId);
    const valid = v.index > 0 && v.index < images.length;
    restoreRef.current = { index: valid ? v.index : 0, top: v.top, left: v.left };
    if (valid) {
      goTo(v.index); // 대상 슬라이드로 전환 — 새 img의 onLoad가 스크롤을 적용
    } else {
      // 첫 슬라이드가 복원 대상: dataURL 등 빠른 로드는 onLoad가 이 effect보다
      // 먼저 발화할 수 있어(passive effect는 paint 이후) 여기서 즉시 1회 시도.
      applyRestoredScroll(0);
    }
  }, [instanceId, images.length, goTo]);

  const indexRef = React.useRef(0);
  const persistView = React.useCallback(() => {
    const el = scrollBoxRef.current;
    writeSlideView(instanceId, {
      index: indexRef.current,
      top: el?.scrollTop ?? 0,
      left: el?.scrollLeft ?? 0,
    });
  }, [instanceId]);

  // 슬라이드가 바뀔 때마다 저장(자동 전환 포함). 마운트 직후 1회는 건너뛰어
  // 복원 전에 저장값이 {0,0}으로 덮이지 않게 한다.
  const skippedFirstPersistRef = React.useRef(false);
  React.useEffect(() => {
    indexRef.current = index;
    if (!skippedFirstPersistRef.current) {
      skippedFirstPersistRef.current = true;
      return;
    }
    persistView();
  }, [index, persistView]);

  // 스크롤(패닝·휠·터치)마다 rAF 스로틀로 저장.
  const scrollRafRef = React.useRef(0);
  const onScroll = () => {
    if (scrollRafRef.current) return;
    scrollRafRef.current = window.requestAnimationFrame(() => {
      scrollRafRef.current = 0;
      persistView();
    });
  };
  React.useEffect(
    () => () => {
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
    },
    [],
  );

  // ── 마우스/펜 드래그 패닝 (터치는 네이티브 스크롤 그대로) ────────────────
  const panRef = React.useRef<{ pointerId: number; x: number; y: number } | null>(
    null,
  );
  const [panning, setPanning] = React.useState(false);
  const onPanPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch" || e.button !== 0) return;
    panRef.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
    setPanning(true);
  };
  const onPanPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== e.pointerId) return;
    const el = scrollBoxRef.current;
    if (!el) return;
    el.scrollTop -= e.clientY - pan.y;
    el.scrollLeft -= e.clientX - pan.x;
    pan.x = e.clientX;
    pan.y = e.clientY;
  };
  const endPan = (e: React.PointerEvent<HTMLDivElement>) => {
    if (panRef.current?.pointerId !== e.pointerId) return;
    panRef.current = null;
    setPanning(false);
    persistView();
  };

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
            ref={scrollBoxRef}
            data-pb-no-drag=""
            onScroll={onScroll}
            onPointerDown={onPanPointerDown}
            onPointerMove={onPanPointerMove}
            onPointerUp={endPan}
            onPointerCancel={endPan}
            className={[
              "h-full w-full overflow-y-auto pb-scroll",
              panning ? "cursor-grabbing select-none" : "cursor-grab",
            ].join(" ")}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- user-supplied URL (Storage upload deferred); can't be allowlisted in next.config, and onError drives the placeholder. */}
            <img
              key={current.id}
              src={current.url}
              alt={current.caption ?? ""}
              loading="lazy"
              draggable={false}
              onLoad={() => applyRestoredScroll(index)}
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
