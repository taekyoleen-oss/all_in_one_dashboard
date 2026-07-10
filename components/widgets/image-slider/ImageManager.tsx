"use client";

/**
 * image-slider · ImageManager — add / remove / reorder images + interval (§2.1 #4).
 *
 *  Controlled: reports the whole next config via onChange (parent owns draft +
 *  persistence). Images can be added FOUR ways:
 *    • 파일 탐색기 — the "파일 선택" button (file input)
 *    • 드래그 앤 드롭 — drop image files (or an image URL) onto the drop zone
 *    • 복사·붙여넣기 — focus the drop zone and Ctrl/⌘+V an image or image URL
 *    • URL 입력 — paste an https image URL
 *
 *  Picked/dropped/pasted files are downscaled on a canvas (max 1280px, JPEG 0.82)
 *  and stored as data URLs in `config` (jsonb), so they SURVIVE reload + sync —
 *  no object URLs (which vanish on reload) and no Storage/signed-URL plumbing.
 *  Aggressive downscaling keeps each image small enough for a jsonb config.
 */

import * as React from "react";
import {
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  Upload,
  ImageOff,
  ImagePlus,
  Loader2,
} from "lucide-react";
import { clampInterval, type ImageSliderConfig, type SlideImage } from "./types";
import { filesToSlides, limitMessage, newImageId } from "./imageFiles";

const isHttpUrl = (s: string) => /^https?:\/\/\S+/i.test(s.trim());

export function ImageManager({
  config,
  onChange,
}: {
  config: ImageSliderConfig;
  onChange: (next: ImageSliderConfig) => void;
}) {
  const [urlInput, setUrlInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [dragOver, setDragOver] = React.useState(false);
  // 저장 상한 초과로 건너뛴 파일 안내(마지막 추가 시도 기준).
  const [limitMsg, setLimitMsg] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement | null>(null);

  const setImages = (images: SlideImage[]) => onChange({ ...config, images });

  const patch = (id: string, fields: Partial<SlideImage>) =>
    setImages(config.images.map((im) => (im.id === id ? { ...im, ...fields } : im)));

  const remove = (id: string) =>
    setImages(config.images.filter((im) => im.id !== id));

  const move = (index: number, dir: -1 | 1) => {
    const next = [...config.images];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setImages(next);
  };

  const appendUrl = (url: string) =>
    setImages([...config.images, { id: newImageId(), url, caption: "" }]);

  const addUrl = () => {
    const url = urlInput.trim();
    if (!url) return;
    appendUrl(url);
    setUrlInput("");
  };

  /**
   * Compress image files → data URLs → append (preserves reload/sync).
   * 장수(MAX_IMAGES)·총량(MAX_TOTAL_CHARS) 상한 초과분은 건너뛰고 안내한다.
   */
  const addFiles = async (files: Iterable<File> | null) => {
    setBusy(true);
    setLimitMsg(null);
    try {
      const { added, skipped } = await filesToSlides(files, config.images);
      if (skipped > 0) setLimitMsg(limitMessage(skipped));
      if (added.length > 0)
        onChange({ ...config, images: [...config.images, ...added] });
    } finally {
      setBusy(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      void addFiles(files);
      return;
    }
    // Dropped an image link (dragging an <img> from another tab).
    const uri =
      e.dataTransfer.getData("text/uri-list") ||
      e.dataTransfer.getData("text/plain");
    if (uri && isHttpUrl(uri)) appendUrl(uri.trim());
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (items) {
      const blobs: File[] = [];
      for (const it of Array.from(items)) {
        if (it.kind === "file" && it.type.startsWith("image/")) {
          const f = it.getAsFile();
          if (f) blobs.push(f);
        }
      }
      if (blobs.length > 0) {
        e.preventDefault();
        void addFiles(blobs);
        return;
      }
    }
    const text = e.clipboardData?.getData("text") ?? "";
    if (isHttpUrl(text)) {
      e.preventDefault();
      appendUrl(text.trim());
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Slideshow title (shown on the tile + expanded view) */}
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">제목 (선택)</span>
        <input
          type="text"
          value={config.title ?? ""}
          onChange={(e) => onChange({ ...config, title: e.target.value })}
          placeholder="예: 여행 사진"
          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>

      {/* Interval control */}
      <label className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">자동 전환 간격(초, 0=꺼짐)</span>
        <input
          type="number"
          min={0}
          max={60}
          value={config.intervalSec}
          onChange={(e) =>
            onChange({
              ...config,
              intervalSec:
                e.target.value === "" ? 0 : clampInterval(Number(e.target.value)),
            })
          }
          className="w-20 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>

      <ul className="flex flex-col gap-2">
        {config.images.map((im, i) => (
          <li
            key={im.id}
            className="flex items-center gap-2 rounded-md border border-border bg-background/40 p-2"
          >
            <span className="relative inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground">
              <ImageOff size={16} aria-hidden />
              {/* eslint-disable-next-line @next/next/no-img-element -- user-supplied data/remote URL; not allowlistable in next.config; onError reveals the placeholder glyph beneath. */}
              <img
                key={im.url}
                src={im.url}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </span>
            <input
              value={im.caption ?? ""}
              onChange={(e) => patch(im.id, { caption: e.target.value })}
              placeholder="캡션 (선택)"
              className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              type="button"
              aria-label={`${i + 1}번 이미지 위로`}
              disabled={i === 0}
              onClick={() => move(i, -1)}
              className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30 pointer-coarse:size-9"
            >
              <ArrowUp size={15} />
            </button>
            <button
              type="button"
              aria-label={`${i + 1}번 이미지 아래로`}
              disabled={i === config.images.length - 1}
              onClick={() => move(i, 1)}
              className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30 pointer-coarse:size-9"
            >
              <ArrowDown size={15} />
            </button>
            <button
              type="button"
              aria-label={`${i + 1}번 이미지 삭제`}
              onClick={() => remove(im.id)}
              className="inline-flex size-7 items-center justify-center rounded-md text-destructive outline-none transition-colors hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:size-9"
            >
              <Trash2 size={15} />
            </button>
          </li>
        ))}
        {config.images.length === 0 ? (
          <li className="rounded-md border border-dashed border-border px-2 py-3 text-center text-xs text-muted-foreground">
            추가된 이미지가 없습니다.
          </li>
        ) : null}
      </ul>

      {/* Drag-drop + paste + file picker (all routed through addFiles → data URLs) */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onPaste={handlePaste}
        tabIndex={0}
        role="group"
        aria-label="이미지 추가 — 드래그, 붙여넣기, 또는 파일 선택"
        className={[
          "flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-3 py-5 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
          dragOver ? "border-primary bg-primary/5" : "border-border",
        ].join(" ")}
      >
        {busy ? (
          <Loader2 size={20} className="animate-spin text-muted-foreground" />
        ) : (
          <ImagePlus size={20} className="text-muted-foreground" aria-hidden />
        )}
        <p className="text-xs text-muted-foreground">
          {busy
            ? "이미지 처리 중…"
            : "여기로 이미지를 드래그하거나, 클릭 후 붙여넣기(Ctrl/⌘+V)"}
        </p>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Upload size={15} aria-hidden />
          파일 선택 (탐색기)
        </button>
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
      </div>

      {limitMsg ? (
        <p role="status" className="text-[11px] text-destructive">
          {limitMsg}
        </p>
      ) : null}

      {/* Add by URL */}
      <div className="flex items-center gap-2">
        <input
          type="url"
          inputMode="url"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addUrl();
            }
          }}
          placeholder="이미지 URL (https://…)"
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="button"
          onClick={addUrl}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus size={15} aria-hidden />
          추가
        </button>
      </div>

      <p className="text-[11px] text-muted-foreground">
        끌어다 놓기 · 붙여넣기 · 파일 선택으로 추가한 이미지는 자동 축소되어 저장되며
        새로고침해도 유지됩니다.
      </p>
    </div>
  );
}

export default ImageManager;
