"use client";

/**
 * image-slider · imageFiles — 파일 → dataURL 축소 저장 + 다운로드 공용 헬퍼.
 *
 *  ImageManager(편집 다이얼로그)와 CompactView(타일 빈 공간 클릭 추가)가 같은
 *  추가 파이프라인을 쓰도록 분리했다. 저장 상한(장수·총량)도 여기서 단일 관리.
 *  다운로드는 dataURL/원격 URL 모두 지원(원격은 fetch→blob, CORS 차단 시 새 탭).
 */

import type { SlideImage } from "./types";

export function newImageId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `img-${crypto.randomUUID().slice(0, 6)}`
    : `img-${Math.random().toString(36).slice(2, 8)}`;
}

const MAX_DIM = 1280;
const JPEG_QUALITY = 0.82;

// config(jsonb) 인라인 저장 상한 — 초과 파일은 건너뛰고 안내한다(기존 이미지는 불변).
export const MAX_IMAGES = 40;
export const MAX_TOTAL_CHARS = 4_000_000; // dataUrl 길이 합으로 총 ~4MB 근사

/** 현재 config에 저장된 이미지 url(대부분 dataUrl)의 총 길이. */
export const totalUrlChars = (images: SlideImage[]) =>
  images.reduce((sum, im) => sum + im.url.length, 0);

/**
 * Read an image File → (optionally) downscale on a canvas → return a data URL.
 * Downscaling keeps the stored config small; on any failure we fall back to the
 * raw data URL so an image is never lost.
 */
export async function fileToDataUrl(file: File): Promise<string> {
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

/**
 * 이미지 파일들을 축소·인코딩해 SlideImage 배열로 만든다(상한 초과분은 skip).
 * 호출자는 { ...config, images: [...existing, ...added] }로 저장하면 된다.
 */
export async function filesToSlides(
  files: Iterable<File> | null,
  existing: SlideImage[],
): Promise<{ added: SlideImage[]; skipped: number }> {
  const arr = Array.from(files ?? []).filter((f) => f.type.startsWith("image/"));
  const added: SlideImage[] = [];
  let count = existing.length;
  let chars = totalUrlChars(existing);
  let skipped = 0;
  for (const file of arr) {
    try {
      if (count >= MAX_IMAGES) {
        skipped++;
        continue;
      }
      const url = await fileToDataUrl(file);
      if (chars + url.length > MAX_TOTAL_CHARS) {
        skipped++;
        continue;
      }
      added.push({
        id: newImageId(),
        url,
        caption: file.name.replace(/\.[^.]+$/, ""),
      });
      count++;
      chars += url.length;
    } catch {
      /* skip an undecodable file */
    }
  }
  return { added, skipped };
}

/* ------------------------------- 클립보드 -------------------------------- */

/**
 * 붙여넣기 이벤트(Ctrl/⌘+V)에서 이미지 파일만 추려낸다.
 * 캡처(Win+Shift+S 등)는 보통 image/png 하나로 들어온다.
 */
export function imagesFromClipboardEvent(
  data: DataTransfer | null | undefined,
): File[] {
  const out: File[] = [];
  for (const it of Array.from(data?.items ?? [])) {
    if (it.kind !== "file" || !it.type.startsWith("image/")) continue;
    const f = it.getAsFile();
    if (f) out.push(f);
  }
  return out;
}

/** 클립보드 읽기 결과 — 버튼 경로는 실패 이유를 사용자에게 알려야 한다. */
export type ClipboardReadResult =
  | { ok: true; files: File[] }
  | { ok: false; reason: "unsupported" | "denied" | "empty" };

/**
 * 버튼용 클립보드 읽기 — `navigator.clipboard.read()`로 OS 클립보드의 이미지를
 * 가져온다(사용자 제스처 안에서 호출해야 하고, 브라우저가 권한을 물을 수 있다).
 * 이벤트 경로와 달리 붙여넣기 대상 위젯이 명확해 타일에서도 안전하다.
 */
export async function readClipboardImages(): Promise<ClipboardReadResult> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.read) {
    return { ok: false, reason: "unsupported" };
  }
  try {
    const items = await navigator.clipboard.read();
    const files: File[] = [];
    for (const item of items) {
      const type = item.types.find((t) => t.startsWith("image/"));
      if (!type) continue;
      const blob = await item.getType(type);
      // 캡처 이미지에는 파일명이 없다 — 빈 이름이면 캡션도 비어 그대로 둔다.
      files.push(new File([blob], "", { type: blob.type || type }));
    }
    return files.length > 0 ? { ok: true, files } : { ok: false, reason: "empty" };
  } catch {
    // 권한 거부·비보안 컨텍스트·문서 비활성 등 — 전부 같은 안내로 묶는다.
    return { ok: false, reason: "denied" };
  }
}

/** 클립보드 읽기 실패 안내 문구(버튼 경로). */
export const clipboardMessage = (
  reason: "unsupported" | "denied" | "empty",
): string =>
  reason === "empty"
    ? "클립보드에 이미지가 없습니다. 화면을 캡처한 뒤 다시 눌러 주세요."
    : reason === "unsupported"
      ? "이 브라우저는 붙여넣기 버튼을 지원하지 않습니다. 위젯을 클릭한 뒤 Ctrl+V를 눌러 주세요."
      : "클립보드 읽기 권한이 필요합니다. 브라우저 권한을 허용하거나 Ctrl+V로 붙여넣어 주세요.";

export const limitMessage = (skipped: number) =>
  `저장 한도(최대 ${MAX_IMAGES}장 · 총 약 ${Math.round(MAX_TOTAL_CHARS / 1_000_000)}MB) 초과로 ${skipped}개 파일을 건너뛰었습니다. 기존 이미지를 삭제한 뒤 다시 추가해 주세요.`;

/* ------------------------------- download -------------------------------- */

const extFromMime = (mime: string) =>
  ({
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/svg+xml": "svg",
    "image/avif": "avif",
  })[mime] ?? "jpg";

/** 파일명으로 쓸 수 없는 문자를 정리(캡션 → 파일명). */
const safeName = (s: string) =>
  s
    .replace(/[\\/:*?"<>|]+/g, " ")
    .trim()
    .slice(0, 60) || "image";

function saveBlob(blob: Blob, name: string) {
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // revoke on the next tick — Safari가 즉시 revoke 시 다운로드를 놓치는 경우 방지.
  window.setTimeout(() => URL.revokeObjectURL(href), 1_000);
}

/**
 * 슬라이드 이미지를 파일로 저장한다.
 *  • dataURL → blob 변환 후 즉시 저장(대부분의 업로드 이미지 경로)
 *  • 원격 URL → fetch→blob 저장, CORS로 실패하면 새 탭으로 열어 수동 저장 안내
 */
export async function downloadSlideImage(
  image: SlideImage,
  fallbackName: string,
): Promise<void> {
  const base = safeName(image.caption?.trim() || fallbackName);
  try {
    const res = await fetch(image.url);
    const blob = await res.blob();
    const ext = extFromMime(blob.type || "image/jpeg");
    saveBlob(blob, `${base}.${ext}`);
  } catch {
    // 원격 이미지가 CORS를 막는 경우 — 새 탭에서 열어 브라우저 저장으로 폴백.
    window.open(image.url, "_blank", "noopener,noreferrer");
  }
}
