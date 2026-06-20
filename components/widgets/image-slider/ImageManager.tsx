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

function newImageId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `img-${crypto.randomUUID().slice(0, 6)}`
    : `img-${Math.random().toString(36).slice(2, 8)}`;
}

const MAX_DIM = 1280;
const JPEG_QUALITY = 0.82;

/**
 * Read an image File → (optionally) downscale on a canvas → return a data URL.
 * Downscaling keeps the stored config small; on any failure we fall back to the
 * raw data URL so an image is never lost.
 */
async function fileToDataUrl(file: File): Promise<string> {
  const raw = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });

  try {
    const img = document.createElement("img");
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("decode failed"));
      img.src = raw;
    });
    const max = Math.max(img.naturalWidth, img.naturalHeight);
    const scale = max > MAX_DIM ? MAX_DIM / max : 1;
    // Small + already-sized: keep the original bytes.
    if (scale === 1 && raw.length < 300_000) return raw;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return raw;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    // Keep PNG (alpha) as PNG; everything else → JPEG for size.
    const type = file.type === "image/png" ? "image/png" : "image/jpeg";
    return canvas.toDataURL(type, JPEG_QUALITY);
  } catch {
    return raw;
  }
}

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

  /** Compress image files → data URLs → append (preserves reload/sync). */
  const addFiles = async (files: Iterable<File> | null) => {
    const arr = Array.from(files ?? []).filter((f) => f.type.startsWith("image/"));
    if (arr.length === 0) return;
    setBusy(true);
    try {
      const added: SlideImage[] = [];
      for (const file of arr) {
        try {
          const url = await fileToDataUrl(file);
          added.push({
            id: newImageId(),
            url,
            caption: file.name.replace(/\.[^.]+$/, ""),
          });
        } catch {
          /* skip an undecodable file */
        }
      }
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
              className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30"
            >
              <ArrowUp size={15} />
            </button>
            <button
              type="button"
              aria-label={`${i + 1}번 이미지 아래로`}
              disabled={i === config.images.length - 1}
              onClick={() => move(i, 1)}
              className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30"
            >
              <ArrowDown size={15} />
            </button>
            <button
              type="button"
              aria-label={`${i + 1}번 이미지 삭제`}
              onClick={() => remove(im.id)}
              className="inline-flex size-7 items-center justify-center rounded-md text-destructive outline-none transition-colors hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring"
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
