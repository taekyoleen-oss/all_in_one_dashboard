"use client";

/**
 * image-slider · ImageManager — add / remove / reorder images + interval (§2.1 #4).
 *
 *  Controlled: reports the whole next config via onChange (parent owns draft +
 *  persistence). Images are added by URL, or by picking local files (previewed via
 *  URL.createObjectURL — these are session-only blobs until Storage lands).
 *
 *  // TODO(storage): upload picked files to pb-images bucket
 *  // {user_id}/{instance_id}/{file} and store signed-URL refs instead of the
 *  // object-URL/raw-URL kept here. Object URLs do not survive a reload or sync.
 */

import * as React from "react";
import { ArrowUp, ArrowDown, Trash2, Plus, Upload, ImageOff } from "lucide-react";
import { clampInterval, type ImageSliderConfig, type SlideImage } from "./types";

function newImageId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `img-${crypto.randomUUID().slice(0, 6)}`
    : `img-${Math.random().toString(36).slice(2, 8)}`;
}

export function ImageManager({
  config,
  onChange,
}: {
  config: ImageSliderConfig;
  onChange: (next: ImageSliderConfig) => void;
}) {
  const [urlInput, setUrlInput] = React.useState("");
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

  const addUrl = () => {
    const url = urlInput.trim();
    if (!url) return;
    setImages([...config.images, { id: newImageId(), url, caption: "" }]);
    setUrlInput("");
  };

  const addFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    // TODO(storage): replace object URLs with uploaded signed-URL refs.
    const added: SlideImage[] = Array.from(files).map((file) => ({
      id: newImageId(),
      url: URL.createObjectURL(file),
      caption: file.name,
    }));
    setImages([...config.images, ...added]);
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
              {/* eslint-disable-next-line @next/next/no-img-element -- user-supplied/object URL (Storage deferred); not allowlistable in next.config; onError reveals the placeholder glyph beneath. */}
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

      {/* Add by local file (object-URL preview; Storage upload deferred) */}
      <div className="flex flex-col gap-1">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            // Allow re-picking the same file.
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Upload size={15} aria-hidden />
          로컬 이미지 선택
        </button>
        <p className="text-xs text-muted-foreground">
          로컬 이미지는 임시 미리보기입니다. 영구 저장(Storage 업로드)은 추후
          지원됩니다.
        </p>
      </div>
    </div>
  );
}

export default ImageManager;
