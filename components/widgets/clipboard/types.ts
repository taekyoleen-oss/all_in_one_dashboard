/**
 * clipboard widget — config shape (클립보드 기록).
 *
 *  Records text copied while this page is open and lets you re-copy any entry
 *  with one click. dataMode:'static' (local). copyBehavior:'custom' (clicking an
 *  entry copies it).
 *
 *  ⚠ Browser limitation: a web app CANNOT silently watch the OS (Windows)
 *  clipboard in the background. We capture copies made ON the page (the `copy`
 *  event) automatically, and provide a "클립보드에서 추가" button that reads the
 *  current OS clipboard on demand (navigator.clipboard.readText, requires a user
 *  gesture + permission). The history is stored in Supabase (pb_clipboard, RLS)
 *  keyed by instanceId so the SAME account syncs it across mobile ⇄ PC (요구);
 *  each entry records the `device` it was copied on for color distinction.
 */

export interface ClipboardConfig {
  /** Max number of entries to keep (older ones are dropped). */
  maxItems: number;
  /** Auto-capture text copied on this page (the `copy` event). */
  captureOnCopy: boolean;
}

export const DEFAULT_CLIPBOARD_CONFIG: ClipboardConfig = {
  maxItems: 30,
  captureOnCopy: true,
};

/** 복사한 기기 종류(모바일 vs PC) — 뷰에서 색으로 구분(요구). */
export type DeviceKind = "mobile" | "pc";

/** One recorded clipboard entry (Supabase pb_clipboard, 기기 간 동기화). */
export interface ClipItem {
  id: string;
  text: string;
  /** Epoch ms when captured. */
  ts: number;
  /** 복사한 기기 종류. */
  device: DeviceKind;
}

/** 기기별 라벨 + 색(모바일·PC 구분 표시). */
export const DEVICE_META: Record<DeviceKind, { label: string; color: string }> = {
  mobile: { label: "모바일", color: "#7C3AED" }, // 바이올렛
  pc: { label: "PC", color: "#0891B2" }, // 시안
};

/** 현재 기기 종류 추정(UA + 포인터/터치 힌트). iPad 데스크톱 UA도 터치로 보정. */
export function detectDevice(): DeviceKind {
  if (typeof navigator === "undefined") return "pc";
  const ua = navigator.userAgent || "";
  const uaMobile =
    /Mobi|Android|iPhone|iPad|iPod|IEMobile|BlackBerry|Opera Mini/i.test(ua);
  let coarse = false;
  try {
    coarse =
      typeof window !== "undefined" &&
      !!window.matchMedia &&
      window.matchMedia("(pointer: coarse)").matches;
  } catch {
    /* ignore */
  }
  const touch = (navigator.maxTouchPoints ?? 0) > 1;
  return uaMobile || (coarse && touch) ? "mobile" : "pc";
}

/** Clamp maxItems to a sane range. */
export function clampMaxItems(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_CLIPBOARD_CONFIG.maxItems;
  return Math.min(200, Math.max(5, Math.round(n)));
}
