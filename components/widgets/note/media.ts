/**
 * note · media helpers — image downscale + file → attachment (인라인 저장).
 *
 *  Images (inserted into the body) are downscaled on a canvas (max 1600px) to
 *  keep the jsonb config small — same approach as the image-slider widget.
 *  Arbitrary attachments are read as data URLs with a size cap (large files are
 *  rejected with a reason, since inline base64 bloats the config).
 */

import { newItemId } from "@/components/widgets/shared/QuickAdd";
import { MAX_ATTACHMENT_BYTES, type NoteAttachment } from "./types";

const MAX_IMG_DIM = 1600;
const JPEG_QUALITY = 0.85;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

/**
 * Read an image File → downscale on a canvas → data URL. Falls back to the raw
 * data URL on any failure so an image is never lost.
 */
export async function imageToDataUrl(file: File): Promise<string> {
  const raw = await readAsDataUrl(file);
  try {
    const img = document.createElement("img");
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("decode failed"));
      img.src = raw;
    });
    const max = Math.max(img.naturalWidth, img.naturalHeight);
    const scale = max > MAX_IMG_DIM ? MAX_IMG_DIM / max : 1;
    if (scale === 1 && raw.length < 400_000) return raw;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return raw;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const type = file.type === "image/png" ? "image/png" : "image/jpeg";
    return canvas.toDataURL(type, JPEG_QUALITY);
  } catch {
    return raw;
  }
}

export interface AttachmentResult {
  attachment?: NoteAttachment;
  /** A user-facing reason when the file was rejected. */
  error?: string;
}

/** Read any File → a NoteAttachment, enforcing the size cap. */
export async function fileToAttachment(file: File): Promise<AttachmentResult> {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    const mb = (MAX_ATTACHMENT_BYTES / (1024 * 1024)).toFixed(0);
    return {
      error: `"${file.name}"이(가) 너무 큽니다 (최대 ${mb}MB). 더 작은 파일을 첨부하세요.`,
    };
  }
  try {
    const dataUrl = await readAsDataUrl(file);
    return {
      attachment: {
        id: newItemId("att"),
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        dataUrl,
      },
    };
  } catch {
    return { error: `"${file.name}"을(를) 읽지 못했습니다.` };
  }
}

/** Human-readable byte size. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
